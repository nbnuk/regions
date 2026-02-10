/*
 *  Copyright (C) 2011 Atlas of Living Australia
 *  All Rights Reserved.
 *
 *  The contents of this file are subject to the Mozilla Public
 *  License Version 1.1 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of
 *  the License at http://www.mozilla.org/MPL/
 *
 *  Software distributed under the License is distributed on an "AS
 *  IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 *  implied. See the License for the specific language governing
 *  rights and limitations under the License.
 */

//= require Leaflet-gridlayer-google-mutant/Leaflet.GoogleMutant.js

var regionWidget;

$(function () {
    google.charts.load('current', {packages: ['corechart'], language: REGION_CONFIG.locale,  callback: chartReady});

    $(document).on("click", "[aa-refresh-zones]", function (event) {
        event.stopPropagation();
        return false;
    });

    jQuery.i18n.properties({
        name: 'messages',
        path: REGION_CONFIG.contextPath + '/messages/i18n/',
        mode: 'map',
        async: true,
        cache: true,
        language: REGION_CONFIG.locale
        // ,callback: function(){ alert( "show.more.species = " + jQuery.i18n.prop('show.more.species')); }
    });

    if (REGION_CONFIG.enableHubData) {
        $("[name='hub-toggle']").bootstrapSwitch({
            size: "small",
            onText: "All",
            onColor: "primary",
            offText: "MDBA",
            offColor: "success",
            onSwitchChange: function (event, state) {
                //console.log("switch toggled", state);
                regionWidget.getCurrentState().showHubData = !state;
                refreshSpeciesGroup();
                taxonomyChart.load()
            }
        });
    }
});

function chartReady() {
    regionWidget = new RegionWidget(REGION_CONFIG);

    regionWidget.setMap(new RegionMap({
        bbox: REGION_CONFIG.bbox,
        useReflectService: REGION_CONFIG.useReflectService,
        enableRegionOverlay: REGION_CONFIG.enableRegionOverlay
    }));

    regionWidget.setTimeControls(new RegionTimeControls());

    google.charts.setOnLoadCallback(function () {
        regionWidget.setTaxonomyWidget(new TaxonomyWidget());
    });

    refreshSpeciesGroup();
}

function setHubConfig() {
    if (REGION_CONFIG.enableHubData) {
        AjaxAnywhere.dynamicParams = {
            showHubData: !$('[name="hub-toggle"]').is(":checked")
        }
    }
}

function refreshSpeciesGroup() {
    $('#groups').click()
}

var region = {
    /**
     * Builds the query as a map that can be passed directly as data in an ajax call
     * @param customParams optional array of parameters
     * @param start [optional] start parameter for paging results
     * @returns [*]
     */
    buildBiocacheQuery: function (customParams, start, forChartValue) {
        var currentState = regionWidget.getCurrentState();

        var forChart = forChartValue || regionWidget.getCurrentState().tab === 'taxonomyTab';

        var params = customParams || [];

        var normalizeQueryValue = function (value) {
            if (!value) {
                return value;
            }
            try {
                // Normalize mixed/partial encodings (e.g. "%20" with raw "&") to a safe encoded form.
                var decoded = decodeURIComponent(value.replaceAll('+', ' '));
                return encodeURIComponent(decoded);
            } catch (e) {
                return encodeURIComponent(value);
            }
        };

        //q= must be first
        if (forChartValue) {
            params.unshift(normalizeQueryValue(currentState.q));
        } else {
            params.unshift("q=" + normalizeQueryValue(currentState.q));
        }

        if (forChart) {
            // show records based on taxonomy chart
            if (taxonomyChart.rank && taxonomyChart.name) {
                params.push("fq=" + taxonomyChart.rank + ":" + encodeURIComponent(taxonomyChart.name));
            }
        } else {
            // show records based on taxa box or group selection
            if (currentState.fq) {
                params.push("fq=" + encodeURIComponent(currentState.fq));
            }
        }

        if (currentState.qc) {
            params.push("qc=" + currentState.qc);
        }

        if (currentState.showHubData || currentState.hubFilter) {
            $.each(currentState.hubFilter.split('&'), function (i, v) {
                var pos = v.indexOf('=');
                if (pos < 0) {
                    params.push(v);
                } else {
                    params.push('fq=' + v.substring(pos + 1))
                }
            });
        }

        params.push("pageSize=50");

        var timeFacet = region.buildTimeFacet();

        if (start) {
            params.push("start=" + start);
        }

        if (timeFacet) {
            params.push("fq=" + encodeURIComponent(timeFacet));
        }

        // remove any empty elements
        params = jQuery.grep(params, function(n){ return (n); });

        //console.log("params", params);
        return params;
    },

    /**
     * Builds the query phrase for a range of dates - returns nothing for the default date range.
     */
    buildTimeFacet: function () {
        if (!regionWidget.isDefaultFromYear() || !regionWidget.isDefaultToYear()) {
            var fromPhrase = regionWidget.isDefaultFromYear() ? '*' : regionWidget.getCurrentState().from + "-01-01T00:00:00Z";
            var toPhrase = regionWidget.isDefaultToYear() ? "*" : regionWidget.getCurrentState().to + "-12-31T23:59:59Z";
            return "occurrence_year:[" + fromPhrase + " TO " + toPhrase + "]";
        } else {
            return '';
        }
    },

    /**
     * Formats numbers as human readable. Handles numbers in the millions.
     * @param count the number
     */
    format: function (count) {
        // Convert de_AT to de-AT, etc
        if (count >= 1000000) {
            return $.i18n.prop("count.million",  Number(count/1000000).toLocaleString(REGION_CONFIG.locale.replace("_", "-"), { minimumFractionDigits: 0, maximumSignificantDigits: 2,  }));
        }
        return Number(count).toLocaleString(REGION_CONFIG.locale.replace("_", "-"));
    },
};

// This function has to be in the global scope for the chart to work
function taxonChartChange(rank, name) {
    regionWidget.getMap().reloadRecordsOnMap();
}


var RegionWidget = function (config) {

    var defaultFromYear = 1850;
    var defaultToYear = new Date().getFullYear();
    var defaultTab = 'speciesTab';
    var regionMap;
    var timeControls;
    var taxonomyWidget;

    /**
     * Essential values to maintain the state of the widget when the user interacts with it
     * @type {{regionName: string, regionType: string, regionFid: string, regionPid: string, regionLayerName: string, group: string, subgroup: string, guid: string, from: string, to: string, tab: string}}
     */
    var state = {
        regionName: '',
        regionType: '',
        regionFid: '',
        regionPid: '',
        regionLayerName: '',
        group: '',
        subgroup: '',
        guid: '',
        fq: '',
        from: '',
        to: '',
        tab: '',
        q: '',
        qc: '',
        hubFilter: '',
        showHubData: false,
        taxa_filter: ''
    };

    var urls = {};

    var mapTheme = {};
    var mapLayers = {};


    /**
     * Constructor
     * @param config
     */
    var init = function (config) {
        state.regionName = config.regionName;
        state.regionType = config.regionType;
        state.regionFid = config.regionFid;
        state.regionPid = config.regionPid;
        state.regionLayerName = config.regionLayerName;
        state.group = state.group ? state.group : 'ALL_SPECIES';
        state.fq = config.fq;
        state.from = state.from ? state.from : defaultFromYear;
        state.to = state.to ? state.to : defaultToYear;
        state.tab = state.tab ? state.tab : defaultTab;
        state.qc = config.qc || '';
        state.q = config.q;
        state.showHubData = config.showHubData || false;
        state.hubFilter = config.hubFilter || '';

        state.taxa_filter = config.taxa_filter;

        // Check previous existing state
        updateState($.bbq.getState());

        urls = config.urls;

        mapTheme = config.mapTheme;
        mapLayers = config.mapLayers;

        initializeTabs();

        // Initialize Ajax activity indicators
        $(document).ajaxStart(
            function (e) {
                showTabSpinner();
            }).ajaxComplete(function () {
            hideTabSpinner();
        });

        // Initialize click events on individual species
        $(document).on('click', "#species tbody tr.link", function () {
            selectSpecies(this);
        });

        // Initialize info message
        $('#timeControlsInfo').popover({trigger:'hover', container: 'body', placement: 'top'});
    };

    /**
     *
     */
    var initializeTabs = function () {

        $('#speciesTab').on('click', function(event) {
            // reset species tab to all species, updating the map
            if (regionWidget) regionWidget.getTimeControls().stop();
            updateState({tab: 'speciesTab'});
            $('#ALL_SPECIES-row i').click();
        });
        $('#taxonomyTab').on('click', function(event) {
            if (regionWidget) regionWidget.getTimeControls().stop();
            updateState({tab: 'taxonomyTab', group: 'ALL_SPECIES', fq: '', subgroup: '', guid: ''});
            taxonomyChart.reset();
        });
        $('#' + state.tab).click();

    };

    /**
     * Updates state with new values and preserve state for when reloading page
     * @param newPartialState
     */
    var updateState = function (newPartialState) {
        $.extend(state, newPartialState);
        //persist current state
        $.bbq.pushState({
            group: state.group,
            subgroup: state.subgroup,
            guid: state.guid,
            from: state.from,
            to: state.to,
            tab: state.tab,
            fq: state.fq
        });
    };

    /**
     * Function called when the user selects a species
     * @param row
     */
    var selectSpecies = function (row) {
        var s = $("#species");
        s.find("tbody tr.link").removeClass('speciesSelected');
        s.find("tbody tr.infoRowLinks").hide();
        var nextTr = $(row).next('tr');
        $(row).addClass('speciesSelected');
        $(nextTr).addClass('speciesSelected');
        $(row).next('tr').show();
        // Update state
        updateState({guid: $(row).attr('id'), fq: "taxon_concept_lsid:\"" + encodeURI($(row).attr('id')) + "\""});
        regionMap.reloadRecordsOnMap();
    };

    /**
     * Hides the tab spinners
     * @param tabId
     */
    var hideTabSpinner = function (tabId) {
        if ($.active === 1) {
            if (tabId) {
                $('#' + tabId + ' i').addClass('hidden');
            } else {
                $('#' + state.tab + ' i').addClass('hidden');
            }
        }
    };

    /**
     * Shows the tab spinners
     * @param tabId
     */
    var showTabSpinner = function (tabId) {
        if (tabId) {
            $('#' + tabId + ' i').removeClass('hidden');
        } else {
            $('#' + state.tab + ' i').removeClass('hidden');
        }
    };

    /**
     * Code to execute when a group is selected
     */
    var selectGroup = function (group, fq) {
        var toggleExpansion = !regionWidget.getTimeControls().isRunning()

        $('.group-row').removeClass('groupSelected');

        if (toggleExpansion) {
            $("tr[parent]").hide();
        }

        if (group !== state.group) {
            $('#' + state.group + '-row i').removeClass('fa-chevron-down').addClass('fa-chevron-right');
        }
        var groupId = group.replace(/[^A-Za-z0-9\\d_]/g, "") + '-row';

        var grp = $('#' + groupId + ' i');
        var isAlreadyExpanded = grp.hasClass('fa-chevron-down');
        if (toggleExpansion) {
            if (isAlreadyExpanded) {
                $("tr[parent='" + groupId + "']").hide();
                grp.removeClass('fa-chevron-down').addClass('fa-chevron-right');
            } else {
                $("tr[parent='" + groupId + "']").show();
                grp.removeClass('fa-chevron-right').addClass('fa-chevron-down');
            }
        }

        // Update widget state
        if (group !== "ALL_SPECIES") {
            updateState({group: group, subgroup: '', guid: '', fq: decodeJSEncodedString(fq)});
        } else {
            updateState({group: group, subgroup: '', guid: '', fq: ''});
        }

        // Mark as selected
        $('#' + groupId).addClass('groupSelected');

        // Last
        if (regionMap) {
            regionMap.reloadRecordsOnMap();
        }
        AjaxAnywhere.dynamicParams = state;
    };

    /**
     * Code to execute when a subgroup is selected
     * @param subgroup
     */
    var selectSubgroup = function (subgroup, fq) {
        $('.group-row').removeClass('groupSelected');
        var subgroupId = subgroup.replace(/[^A-Za-z\\d_]/g, "") + '-row';

        // Update widget state
        updateState({subgroup: subgroup, guid: '', fq: fq});
        // Mark as selected
        $('#' + subgroupId).addClass('groupSelected');

        // Last
        if (regionMap) {
            regionMap.reloadRecordsOnMap();
        }
        AjaxAnywhere.dynamicParams = state;
    };

    var getGroupId = function () {
        return state.group.replace(/[^A-Za-z0-9\\d_]/g, "") + '-row';
    };

    var getSubgroupId = function () {
        return state.subgroup.replace(/[^A-Za-z0-9\\d_]/g, "") + '-row';
    };

    var _public = {

        isDefaultFromYear: function () {
            return state.from === defaultFromYear;
        },

        isDefaultToYear: function () {
            return state.to === defaultToYear;
        },

        getDefaultFromYear: function () {
            return defaultFromYear;
        },

        getDefaultToYear: function () {
            return defaultToYear;
        },

        getTimeControls: function () {
            return timeControls;
        },

        updateDateRange: function (from, to) {
            updateState({
                from: from,
                to: to
            });
            if (state.subgroup) {
                $('#' + getSubgroupId()).click();
            } else {
                $('#' + getGroupId()).click();
            }
            // Update taxonomy chart
            if (taxonomyChart && taxonomyWidget) {
                taxonomyChart.updateQuery(taxonomyWidget.getQuery() + "&fq=" + encodeURIComponent(region.buildTimeFacet()));
            }
        },

        getUrls: function () {
            return urls;
        },

        getMapTheme: function() {
            return mapTheme;
        },
        getMapLayers: function() {
            return mapLayers;
        },

        getCurrentState: function () {
            return state;
        },

        groupsLoaded: function () {
            $('#groups').effect('highlight', {color: '#ededed'}, 2000);
            if (state.subgroup) {
                // Display group hidden rows
                $("tr[parent='" + getGroupId() + "']").show();
                $('#' + getGroupId() + ' i').removeClass('fa-chevron-right').addClass('fa-chevron-down');
                $('#' + getSubgroupId()).click();
            } else {
                $('#' + getGroupId()).click();
            }
        },

        selectGroupHandler: function (group, isSubgroup, fq) {
            if (isSubgroup) {
                selectSubgroup(group, fq);
            } else {
                selectGroup(group, fq);
            }
        },

        speciesLoaded: function () {
            var msz = $('#moreSpeciesZone');
            $('#species').effect('highlight', {color: '#ededed'}, 2000);
            var totalRecords = msz.attr('totalRecords');
            if (isNaN(totalRecords)) {
                $('#totalRecords').text('');
            } else {
                $('#totalRecords').text('(' + region.format(parseInt(msz.attr('totalRecords'))) + ')');
            }

            $('#occurrenceRecords').effect('highlight', {color: '#ededed'}, 2000);

            var speciesCount = msz.attr('speciesCount');
            if (isNaN(speciesCount)) {
                $('#speciesCount').text('');
            } else {
                $('#speciesCount').text('(' + region.format(parseInt(msz.attr('speciesCount'))) + ')');
            }
            $('#speciesCountLabel').effect('highlight', {color: '#ededed'}, 2000);
        },

        showMoreSpecies: function () {
            $('#showMoreSpeciesButton').html("<i class='fa fa-cog fa-spin'></i>");
            AjaxAnywhere.dynamicParams = this.getCurrentState();
        },

        setMap: function (map) {
            regionMap = map;
        },

        getMap: function () {
            return regionMap;
        },

        setTimeControls: function (tc) {
            timeControls = tc;
        },

        setTaxonomyWidget: function (tw) {
            taxonomyWidget = tw;
        },

        getTaxonomyWidget: function () {
            return taxonomyWidget;
        },

        showDownloadDialog: function () {
            AjaxAnywhere.dynamicParams = this.getCurrentState();
            $('#downloadRecordsModal').modal('show');
        }
    };

    init(config);
    return _public;
};

/**
 *
 * @param config
 * @returns {{}}
 * @constructor
 */
var RegionTimeControls = function (config) {

    var timeSlider;
    var CONTROL_STATES = {
        PLAYING: 0,
        PAUSED: 1,
        STOPPED: 2
    };
    var state = CONTROL_STATES.STOPPED;
    var refreshInterval;
    var playTimeRange;

    var init = function (config) {
        timeSlider = $('#timeSlider');

        timeSlider.slider({
            min: regionWidget.getDefaultFromYear(),
            max: regionWidget.getDefaultToYear(),
            range: true,
            values: [regionWidget.getCurrentState().from, regionWidget.getCurrentState().to],
            create: function () {
                updateTimeRange(timeSlider.slider('values'));
            },
            slide: function (event, ui) {
                updateTimeRange(ui.values);
            },
            change: function (event, ui) {
                if (!(state === CONTROL_STATES.PLAYING)
                    || (ui.values[0] !== ui.values[1] && ui.values[1] - ui.values[0] <= 10 )) {
                    regionWidget.updateDateRange(ui.values[0], ui.values[1]);
                }
                updateTimeRange(ui.values);
            }
        })
        .slider("pips", {
            rest: "pip",
            step: 10
        })
        .slider("float", {});

        initializeTimeControlsEvents();
    };

    var initializeTimeControlsEvents = function () {
        // Initialize play button
        $('#playButton').on('click', function () {
            play();
        });

        // Initialize stop button
        $('#stopButton').on('click', function () {
            stop();
        });

        // Initialize pause button
        $('#pauseButton').on('click', function () {
            pause();
        });

        // Initialize reset button
        $('#resetButton').on('click', function () {
            reset();
        });

    };

    var increaseTimeRangeByADecade = function () {
        var ts = $('#timeSlider');
        var incrementTo = (regionWidget.getDefaultToYear() - playTimeRange[1]) < 10 ? regionWidget.getDefaultToYear() - playTimeRange[1] : 10;
        if (incrementTo !== 0) {
            ts.slider('values', [playTimeRange[0] + 10, playTimeRange[1] + incrementTo]);
            playTimeRange = ts.slider('values');
        } else {
            stop();
        }
    };

    var play = function () {

        var ts = $('#timeSlider');
        switch (state) {
            case CONTROL_STATES.STOPPED:
                // Start playing from the beginning
                // Update state before updating slider values
                state = CONTROL_STATES.PLAYING;
                ts.slider('values', [regionWidget.getDefaultFromYear(), regionWidget.getDefaultFromYear() + 10]);
                break;
            case CONTROL_STATES.PAUSED:
                // Resume playing
                // Update state before updating slider values
                state = CONTROL_STATES.PLAYING;
                ts.slider('values', [playTimeRange[0], playTimeRange[1]]);
                break;
        }

        // For SVG elements the addClass and removeClass jQuery method do not work
        $('#pauseButton').removeClass('selected').trigger('selected');
        $('#playButton').addClass('selected').trigger('selected');
        playTimeRange = ts.slider('values');
        refreshInterval = setInterval(function () {
            increaseTimeRangeByADecade();
        }, 4000);
    };

    var stop = function () {
        clearInterval(refreshInterval);
        $('#pauseButton').removeClass('selected').trigger('selected');
        $('#playButton').removeClass('selected').trigger('selected');
        state = CONTROL_STATES.STOPPED;
    };

    var pause = function () {
        if (state === CONTROL_STATES.PLAYING) {
            $('#pauseButton').addClass('selected').trigger('selected');
            $('#playButton').removeClass('selected').trigger('selected');
            clearInterval(refreshInterval);
            state = CONTROL_STATES.PAUSED;
        }
    };

    var reset = function () {
        $('#timeSlider').slider('values', [regionWidget.getDefaultFromYear(), regionWidget.getDefaultToYear()]);
        stop();
        regionWidget.updateDateRange(regionWidget.getDefaultFromYear(), regionWidget.getDefaultToYear());
        regionWidget.updateDateRange(regionWidget.getDefaultFromYear(), regionWidget.getDefaultToYear()); // called for a 2nd time for the use case when a "group" is select to restore the expansion toggle state
    };

    var updateTimeRange = function (values) {
        $('#timeFrom').text(values[0]);
        $('#timeTo').text(values[1]);
    };

    var _public = {
        isRunning: function () {
            return state === CONTROL_STATES.PLAYING;
        },
        stop: function() {
            stop();
        }
    };

    init(config);
    return _public;
};

var TaxonomyWidget = function (config) {

    var taxonomyChartOptions, query;

    var TaxonomyWidget = function (config) {
        var currentState = regionWidget.getCurrentState();

        query = '';
        $.each(region.buildBiocacheQuery([], 0, true), function (i, v) {
            if (query.length === 0) {
                query = v
            } else if (v.length > 0) {
                if (v.charAt(0) != '&') {
                    query += '&'
                }
                query += v
            }
        });

        taxonomyChartOptions = {
            query: query,
            currentState: currentState,
            subquery: '&fq=' + encodeURIComponent(region.buildTimeFacet()),
            rank: "kingdom",
            width: 550,
            height: 420,
            clickThru: false,
            notifyChange: "taxonChartChange",
            collectionsUrl: regionWidget.getUrls().regionsApp,
            biocacheServicesUrl: regionWidget.getUrls().biocacheServiceUrl,
            displayRecordsUrl: regionWidget.getUrls().biocacheWebappUrl
        };

        taxonomyChart.load(taxonomyChartOptions);
    };

    var _public = {
        getQuery: function () {
            return query;
        }

    };

    TaxonomyWidget(config);
    return _public;
};

/**
 *
 * @param config
 * @returns
 * @constructor
 */
var RegionMap = function (config) {

    var map;
    var overlays = [null, null];  // first is the region, second is the occurrence data
    var defaultOccurrenceOpacity = 0.7;
    var defaultRegionOpacity = 0.5;
    var initialBounds;
    var useReflectService = true;
    var overlayFormat = "image/png";
    var enableRegionOverlay = true;

    var init = function (config) {

        initialBounds = L.latLngBounds(
            L.latLng(config.bbox.sw.lat, config.bbox.sw.lng),
            L.latLng(config.bbox.ne.lat, config.bbox.ne.lng));

        useReflectService = config.useReflectService;
        enableRegionOverlay = config.enableRegionOverlay;

        // create leaflet map object
        map = L.map(document.getElementById("region-map"), {
            scrollWheelZoom: false,
        });

        // Fallbacks for config entries that might be missing
        let baseUrl = REGION_CONFIG.mapMinimalUrl ||
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        let baseLayerOptions = {
            attribution: REGION_CONFIG.mapMinimalAttribution ||
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        };

        // Only set subdomains if we actually have a value
        if (REGION_CONFIG.mapMinimalSubdomains) {
            if (Array.isArray(REGION_CONFIG.mapMinimalSubdomains)) {
                baseLayerOptions.subdomains = REGION_CONFIG.mapMinimalSubdomains;
            } else if (typeof REGION_CONFIG.mapMinimalSubdomains === 'string') {
                baseLayerOptions.subdomains =
                    REGION_CONFIG.mapMinimalSubdomains.indexOf(',') >= 0
                        ? REGION_CONFIG.mapMinimalSubdomains.split(',')
                        : REGION_CONFIG.mapMinimalSubdomains;
            }
        }

        let defaultBaseLayer = L.tileLayer(baseUrl, baseLayerOptions);

        if (REGION_CONFIG.useGoogleApi) {
            // only show layer controls when Google API key is available
            let baseLayers = {
                Minimal: defaultBaseLayer,
                Road: L.gridLayer.googleMutant({ type: 'roadmap' }),
                Terrain: L.gridLayer.googleMutant({ type: 'terrain' }),
                Satellite: L.gridLayer.googleMutant({ type: 'hybrid' })
            };
            map.layerControl = L.control.layers(baseLayers).addTo(map);
        }

        map.addLayer(defaultBaseLayer);
        map.fitBounds(initialBounds);

        map.on('baselayerchange', function() {
            // prevent baselayers covering/hiding overlay layers when switching baselayers
            if (map.hasLayer(overlays[0])) {
                overlays[0].bringToFront();
            }
            if (map.hasLayer(overlays[1])) {
                overlays[1].bringToFront();
            }
        });

        initializeOpacityControls();

        /*****************************************\
         | Overlay the region shape
         \*****************************************/
        drawRegionOverlay();

        /*******************************************************\
         | Hack the viewport if we don't have good bbox data
         \*******************************************************/
        // fall-back attempt at bounding box if all of Oz
        if (false && initialBounds.equals(new google.maps.LatLngBounds(
                new google.maps.LatLng(-42, 113),
                new google.maps.LatLng(-14, 153)))) {
            $.ajax({
                url: regionWidget.getUrls().proxyUrlBbox + "?q=" + decodeURI(regionWidget.getCurrentState().q),
                //url: url,
                dataType: 'json',
                success: function (data) {
                    if (data[0] !== 0.0) {
                        initialBounds = new google.maps.LatLngBounds(
                            new google.maps.LatLng(data[1], data[0]),
                            new google.maps.LatLng(data[3], data[2]));
                        map.fitBounds(initialBounds);
                        $('#using-bbox-hack').html("Using occurrence bounds");
                        $('#bbox').html("Using bbox " + initialBounds.toString());
                    }
                }
            });
        }

        var urls = regionWidget.getUrls();
        var mapTheme = regionWidget.getMapTheme();
        var mapLayers = regionWidget.getMapLayers();
        if (mapLayers.mapLayersLabels != '') {
            addMapLegend(true);
        } else {
            $('#mapLegend').hide();
        }
    };

    /**
     * Set up opacity sliders
     */
    var initializeOpacityControls = function () {

        $('#occurrencesOpacity').slider({
            min: 0,
            max: 100,
            value: defaultOccurrenceOpacity * 100,
            change: function (event, ui) {
                drawRecordsOverlay();
            }
        });
        $('#regionOpacity').slider({
            min: 0,
            max: 100,
            value: defaultRegionOpacity * 100,
            change: function (event, ui) {
                drawRegionOverlay();
            }
        });

        // Dixes accordion width
        var oc = $('#opacityControls');
        oc.width(oc.width() + 2);

        oc.find('a').on('click', function () {
            if ($('#opacityControlsContent').hasClass('in')) {
                oc.find('i').switchClass('fa-chevron-down', 'fa-chevron-right');
            } else {
                oc.find('i').switchClass('fa-chevron-right', 'fa-chevron-down');
            }
        });

        // layer toggling
        $("#toggleOccurrences").click(function () {
            $('#maploading').fadeOut("fast");
            (this.checked)
                ? $('#occurrencesOpacity').slider('enable')
                : $('#occurrencesOpacity').slider('disable');
            for (var i = 1; i < map.overlayMapTypes.length; i++) {
                toggleOverlay(i, this.checked);
            }
        });
        $("#toggleRegion").click(function () {
            $('#maploading').fadeOut("fast");
            (this.checked)
                ? $('#regionOpacity').slider('enable')
                : $('#regionOpacity').slider('disable');
            toggleOverlay(0, this.checked);
        });
    };

    var addMapLegend = function (addToMap) {

        var mapTheme = regionWidget.getMapTheme();
        var mapLayers = regionWidget.getMapLayers();

        $('#mapLegendTable').html('');
        $("#mapLegendTable")
            .append($('<tr>')
                .append($('<td>')
                    .addClass('legendTitle')
                    .html(mapTheme.mapEnvLegendTitle + ":")
                )
            );

            //use predefined legend entries and colours
            var mapLabelsArr = mapLayers.mapLayersLabels.split("|");
            var mapColoursArr = mapLayers.mapLayersColours.split("|");
            for (var i = 0; i < mapLabelsArr.length; i++) {
                addLegendItem(mapLabelsArr[i], 0, 0, 0, mapColoursArr[i],false); //use rgbhex and full label provided
            }

        if (addToMap) {
            var legend = L.control({ position: "topleft" });
            legend.onAdd = function(){return document.getElementById('mapLegend');}
            legend.addTo(map);
        }
        return;
    };

    /**
     * Called when the overlays are loaded. Not currently used
     * @param numtiles
     */
    var wmsTileLoaded = function (numtiles) {
        $('#maploading').fadeOut("slow");
    };

    /**
     * Turns the overlay layers on or off
     * @param n index of the overlay in the overlays list
     * @param show true to show; false to hide
     */
    var toggleOverlay = function (n, show) {
        //map.overlayMapTypes.setAt(n, show ? overlays[n] : null);
        if (show) {
            map.addLayer(overlays[n]);
            overlays[n].bringToFront();
        } else {
            map.removeLayer(overlays[n]);
        }
    };

    /**
     * Returns the value of the opacity slider for the region overlay.
     */
    var getRegionOpacity = function () {
        var opacity = $('#regionOpacity').slider("value");
        return isNaN(opacity) ? defaultRegionOpacity : opacity / 100;
    };

    /**
     * Returns the value of the opacity slider for the occurrence overlay.
     */
    var getOccurrenceOpacity = function () {
        var opacity = $('#occurrencesOpacity').slider("value");
        return isNaN(opacity) ? defaultOccurrenceOpacity : opacity / 100;
    };

    /**
     * Load the region as a WMS overlay.
     */
    var drawRegionOverlay = function () {

        if (enableRegionOverlay) {
            var currentState = regionWidget.getCurrentState();
            var urls = regionWidget.getUrls();

            if (map.hasLayer(overlays[0])) {
                map.removeLayer(overlays[0]);
            }

            if (currentState.q.indexOf("%3A*") === currentState.q.length - 4) {
                // q contains wildcard field value, e.g. `cl22%3A*` (cl22:*)
                var layerParams = {
                    FORMAT: overlayFormat,
                    LAYERS: "ALA:" + currentState.regionLayerName,
                    STYLES: "polygon",
                    TRANSPARENT: true,
                    opacity: getRegionOpacity()
                };
                overlays[0] = L.tileLayer.wms(urls.spatialCacheUrl, layerParams);
                $('#maploading').fadeIn("fast");
                overlays[0].on('add', function (event) {
                    overlays[0].bringToFront();
                    if (overlays[1]) overlays[1].bringToFront(); // so records are always on top
                    $('#maploading').fadeOut("fast");
                });
                map.addLayer(overlays[0]);
            } else {
                // q contains an actual field value, e.g. `cl22%3A%22Queensland%22` (cl22:"Queensland")
                var params = {
                    FORMAT: overlayFormat,
                    LAYERS: "ALA:Objects",
                    viewparams: "s:" + currentState.regionPid,
                    STYLES: "polygon",
                    TRANSPARENT: true,
                    opacity: getRegionOpacity()
                };
                overlays[0] = L.tileLayer.wms(urls.spatialWmsUrl, params);
                $('#maploading').fadeIn("fast");

                overlays[0].on('add', function (event) {
                    overlays[0].bringToFront();
                    if (overlays[1]) overlays[1].bringToFront(); // so records are always on top
                    $('#maploading').fadeOut("fast");
                });
                map.addLayer(overlays[0]);
            }
        }
    };

    /**
     * Load occurrence data as a wms overlay based on the current selection:
     * - if taxa box is visible, show the selected species group or species
     * - if taxonomy chart is selected, show the current named rank
     * - use date restriction specified by the time slider
     */
    var drawRecordsOverlay = function () {
        var urls = regionWidget.getUrls();
        var mapTheme = regionWidget.getMapTheme();
        var mapLayers = regionWidget.getMapLayers();


        if (useReflectService) {
            drawRecordsOverlay2();
            return;
        }

        var queryParams = [];
        var wmsParams = {
            format: overlayFormat,
            opacity: getOccurrenceOpacity(),
            symsize: 4,
            colourby: 3368652
        };
        var query = region.buildBiocacheQuery(queryParams, 0).join("&");
        overlays[1] = L.tileLayer.wms(urlConcat(urls.biocacheServiceUrl, "occurrences/wms?") + query, wmsParams);
        $('#maploading').fadeIn("fast");

        overlays[1].on('add', function (event) {
            overlays[1].bringToFront();
            $('#maploading').fadeOut("fast");
        });
        map.addLayer(overlays[1]);
    };

    var drawRecordsOverlay2 = function () {
        var urls = regionWidget.getUrls();
        var mapTheme = regionWidget.getMapTheme();
        var mapLayers = regionWidget.getMapLayers();

        var url = urls.biocacheServiceUrl + "/mapping/wms/reflect?";

        // remove previous records layers
        for (var i = 1; i < overlays.length; i++) {
            if (overlays[i]) {
                map.removeLayer(overlays[i]);
            }
        }

        var wmsParams = {
            format: overlayFormat,
            layers: "ALA:occurrences",
            styles: "",
            bgcolor: "0xFFFFFF",
            cql_filter: "",
            symsize: 3,
            exceptions: "application-vnd.ogc.se_inimage",
            outline: false,
            opacity: getOccurrenceOpacity(),
            uppercase: true
        };

        // do not fade in while the time slider is playing
        if (!regionWidget.getTimeControls()
            || !regionWidget.getTimeControls().isRunning
            || !regionWidget.getTimeControls().isRunning()) {
            $('#maploading').fadeIn("fast");
        }

        if (mapLayers.mapLayersFqs != '') {
            // additional FQ criteria for each map layer
            var fqsArr = mapLayers.mapLayersFqs.split("|");
            var coloursArr = mapLayers.mapLayersColours.split("|");

            for (var i = 0; i < fqsArr.length; i++) {
                var query = region.buildBiocacheQuery([], 0).join("&");

                wmsParams.env = mapTheme.mapEnvOptions +
                    ";opacity:" + getOccurrenceOpacity() +
                    ";color:" + coloursArr[i];

                // NOTE: hack preserved from original code
                if (i === 0) {
                    overlays[i + 1] = L.tileLayer.wms(
                        url + query + "&fq=identification_verification_status:(\"Unconfirmed\" OR \"Unconfirmed - plausible\" OR \"Unconfirmed - unreviewed\")",
                        wmsParams
                    );
                } else {
                    overlays[i + 1] = L.tileLayer.wms(
                        url + query + "&fq=identification_verification_status:(\"Accepted\" OR \"Accepted - considered correct\" OR \"Accepted - correct\" OR \"verified\")",
                        wmsParams
                    );
                }

                overlays[i + 1].on('add', function () {
                    overlays[i + 1].bringToFront();
                    $('#maploading').fadeOut("fast");
                });
                map.addLayer(overlays[i + 1]);
            }
        } else {
            var query = region.buildBiocacheQuery([], 0).join("&");
            wmsParams.env = mapTheme.mapEnvOptions + ";opacity:" + getOccurrenceOpacity();

            overlays[1] = L.tileLayer.wms(url + query, wmsParams);
            overlays[1].on('add', function () {
                overlays[1].bringToFront();
                $('#maploading').fadeOut("fast");
            });
            map.addLayer(overlays[1]);
        }

        // (re)build legend
        if (mapLayers.mapLayersLabels != '') {
            addMapLegend(false);
        } else {
            $('#mapLegend').hide();
        }
    };

    var _public = {
        reloadRecordsOnMap: function () {
            drawRecordsOverlay();
        }
    };

    init(config);
    return _public;
};

/**
 * Some JS variables are generated in GSP via the `encodeAsJS()` or `encodeAsJavaScript()` codec.
 * This function decodes the generated unicode chars, such as "\u002c" to ",".
 * Taken from https://stackoverflow.com/a/7885499/249327
 *
 * @param text
 */
function decodeJSEncodedString(text) {
    var r = /\\u([\d\w]{4})/gi;
    return text.replace(r, function (match, grp) { return String.fromCharCode(parseInt(grp, 16)); } );
}

function addLegendItem(name, red, green, blue, rgbhex, hiderangemax){
    //Copied from legacy. A lot of the code is not needed for the simple, fixed, legend we have
    var isoDateRegEx = /^(\d{4})-\d{2}-\d{2}T.*/; // e.g. 2001-02-31T12:00:00Z with year capture

    if (name.search(isoDateRegEx) > -1) {
        // convert full ISO date to YYYY-MM-DD format
        name = name.replace(isoDateRegEx, "$1");
    }
    var startOfRange = name.indexOf(":[");
    if (startOfRange != -1) {
        var nameVal = name.substring(startOfRange+1).replace("["," ").replace("]"," ").replace(" TO "," to ").trim();
        if (hiderangemax) nameVal = nameVal.split(' to ')[0];
    } else {
        var nameVal = name;
    }
    var legendText = (nameVal);

    $("#mapLegendTable")
        .append($('<tr>')
            .append($('<td>')
                .append($('<i>')
                    .addClass('legendColour')
                    .attr('style', "background-color:" + (rgbhex!=''? "#" + rgbhex : "rgb("+ red +","+ green +","+ blue + ")") + ";")
                )
                .append($('<span>')
                    .addClass('legendItemName')
                    .html(legendText)
                )
            )
        );
}

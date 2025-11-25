<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
    <meta name="breadcrumbParent" content="${grailsApplication.config.breadcrumbParent}"/>
    <meta name="breadcrumb" content="${g.message(code:'regions.title')}"/>
    <meta name="layout" content="${grailsApplication.config.getProperty('skin.layout') ?: 'main'}"/>

    <title><g:message code="regions.title"/> | ${grailsApplication.config.orgNameLong ?: 'Atlas of Living Australia'}</title>

    <script src="${g.createLink(controller: 'data', action: 'regionsMetadataJavascript')}"></script>
    <script src="https://maps.google.com/maps/api/js?key=${grailsApplication.config.google.apikey}"></script>
    <script src="https://www.gstatic.com/charts/loader.js"></script>

    <asset:stylesheet src="leaflet/leaflet"/>
    <asset:stylesheet src="application"/>
    <asset:javascript src="leaflet/leaflet"/>
    <asset:javascript src="dependencies.js"/>
    <asset:javascript src="regions_app"/>
    <asset:javascript src="regions_page"/>
</head>
<body class="nav-locations">
<div class="row">
    <div class="col-md-12">
        <g:if test="${flash.message}">
            <div class="message">${flash.message}</div>
        </g:if>
        <h1><g:message code="select.region.title"/></h1>
        <p>
            <g:message code="select.region.help1"/>
            <br/>
            <g:message code="select.region.help2"/>
        </p>
    </div>
</div>

<div class="row">
    <div class="col-md-4">
        <p style="font-size:15px;margin-left:15px;padding-bottom:0;"><i
                class="fa fa-info-circle"></i>
            <g:message code="select.region.help3"/>
        </p>
        <div id="accordion">
            <g:each in="${menu}" var="item">
                <h2><a href="#">${item.label}</a>
                    <g:if test="${grailsApplication.config.getProperty("showNotesInfoInAccordionPanel", Boolean, false) && item.notes?.length() > 0}">
                        <span class="glyphicon glyphicon glyphicon-info-sign layer-info" aria-hidden="true" data-toggle="tooltip" title="${item.notes}"></span>
                    </g:if>
                </h2>
                <div id="${item.layerName}" layer="${item.label}"><span class="loading">
                    <g:message code="loading"/>
                </span>
                </div>
            </g:each>
        </div>
%{--        From Species--}%
        <div class="input-group">
            <input id="taxaFilter" name="fq" type="hidden" value="idxtype:TAXON">
            <input id="search" class="form-control ac_input general-search" name="q" type="text" placeholder="Search the Atlas" autocomplete="on">
            <span class="input-group-btn">
                <input type="submit" class="form-control btn btn-primary" alt="Search" value="Search">
            </span>
        </div>
%{--        Example--}%
        <div class="form-group position-relative" style="max-width: 480px;">
            <label for="region-autocomplete" class="font-weight-bold">
                Search and select a region
            </label>

            <input
                    id="region-autocomplete"
                    type="text"
                    class="form-control"
                    autocomplete="off"
                    placeholder="Start typing a region name…"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded="false"
                    aria-owns="region-autocomplete-list"
            />

            <!-- Suggestion dropdown -->
            <div
                    id="region-autocomplete-list"
                    class="list-group position-absolute w-100 shadow-sm"
                    role="listbox"
                    style="z-index: 1050; max-height: 260px; overflow-y: auto; display: none;"
            >
                <!-- Suggestions injected here via JS -->
            </div>

            <small class="form-text text-muted">
                Type at least 2 characters, then use ↑/↓ and Enter to choose.
            </small>
        </div>
    </div>

    <div class="col-md-8" id="rightPanel">
        <span id="click-info"><i class="fa fa-info-circle"></i>
            <g:message code="select.region.help4"/>
        </span>
        <span class="btn btn-default" id="reset-map"><i class="fa fa-refresh"></i>
            <g:message code="reset.map"/>
        </span>

        <div id="map">
            <div id="map-container">
                <div id="map_canvas"></div>

                <div id="maploading" class="maploading" hidden>
                    <div>
                        <i class="spinner fa fa-cog fa-spin fa-3x"></i>
                    </div>
                </div>
            </div>

            <div id="controls">
                <div>
                    <div class="tish">
                        <div class="checkbox">
                            <label for="toggleLayer">
                                <input type="checkbox" name="layer" id="toggleLayer" value="1" checked>
                                <g:message code="all.regions"/>
                            </label>
                        </div>
                    </div>
                    <div id="layerOpacity"></div>
                </div>

                <div>
                    <div class="tish">
                        <div class="checkbox">
                            <label for="toggleRegion">
                                <input type="checkbox" name="region" id="toggleRegion" value="1" checked disabled>
                                <g:message code="selected.region"/>
                            </label>
                        </div>
                    </div>
                    <div id="regionOpacity"></div>
                </div>
            </div>
        </div><!--close map-->
    </div>
</div>

<asset:script type="text/javascript">
    var altMap = true;
    $(function() {

        $('#dev-notes').dialog({autoOpen: false, show: 'blind', hide: 'blind'});
        $('#dev-notes-link').click(function() {
            $('#dev-notes').dialog('open');
            return false;
        });

        init_regions({
            server: '${grailsApplication.config.grails.serverURL}',
            spatialService: "${grailsApplication.config.layersService.baseURL}/",
            spatialWms: "${grailsApplication.config.geoserver.baseURL}/ALA/wms?",
            spatialCache: "${grailsApplication.config.geoserver.baseURL}/ALA/wms?",
            accordionPanelMaxHeight: '${grailsApplication.config.accordion.panel.maxHeight}',
            mapBounds: JSON.parse('${grailsApplication.config.map.bounds ?: []}'),
            mapHeight: '${grailsApplication.config.map.height}',
            mapContainer: 'map_canvas',
            defaultRegionType: "${grailsApplication.config.default.regionType}",
            defaultRegion: "${grailsApplication.config.default.region}",
            showQueryContextLayer: ${grailsApplication.config.layers.showQueryContext},
            queryContextLayer: {
                name:"${grailsApplication.config.layers.queryContextName}",
                shortName:"${grailsApplication.config.layers.queryContextShortName}",
                fid:"${grailsApplication.config.layers.queryContextFid}",
                bieContext:"${grailsApplication.config.layers.queryContextBieContext}",
                order:"${grailsApplication.config.layers.queryContextOrder}",
                displayName:"${grailsApplication.config.layers.queryContextDisplayName}"
            },
            useGoogleApi: '${(grailsApplication.config.getProperty('google.apikey')) ? "true": ""}'
        });
    });

    $('[data-toggle="tooltip"]').tooltip();


%{--    (function () {--}%
%{--        const input = document.getElementById('region-autocomplete');--}%
%{--        const list  = document.getElementById('region-autocomplete-list');--}%

%{--        if (!input || !list || !Array.isArray(REGIONS)) return;--}%

%{--        let filtered = [];--}%
%{--        let activeIndex = -1;--}%

%{--        function setListVisible(visible) {--}%
%{--            list.style.display = visible && filtered.length ? 'block' : 'none';--}%
%{--            input.setAttribute('aria-expanded', visible && filtered.length ? 'true' : 'false');--}%
%{--        }--}%

%{--        function clearList() {--}%
%{--            list.innerHTML = '';--}%
%{--            filtered = [];--}%
%{--            activeIndex = -1;--}%
%{--            setListVisible(false);--}%
%{--        }--}%

%{--        function renderList() {--}%
%{--            list.innerHTML = '';--}%
%{--            if (!filtered.length) {--}%
%{--                setListVisible(false);--}%
%{--                return;--}%
%{--            }--}%

%{--            filtered.forEach((region, index) => {--}%
%{--                const item = document.createElement('button');--}%
%{--                item.type = 'button';--}%
%{--                item.className = 'list-group-item list-group-item-action';--}%
%{--                item.setAttribute('role', 'option');--}%
%{--                item.setAttribute('data-index', index);--}%
%{--                item.setAttribute('data-id', region.id);--}%

%{--                // Optional: show type as muted text--}%
%{--                item.innerHTML = `--}%
%{--                    <div class="d-flex flex-column">--}%
%{--                        <span>${region.name}</span>--}%
%{--                        <small class="text-muted">${region.type}</small>--}%
%{--                        ${region.type ? `<small class="text-muted">${region.type}</small>` : ''}--}%
%{--                    </div>--}%
%{--                    `;--}%

%{--        item.addEventListener('mousedown', function (e) {--}%
%{--            // mousedown so click works before blur--}%
%{--            e.preventDefault();--}%
%{--            selectRegionByIndex(index);--}%
%{--        });--}%

%{--        list.appendChild(item);--}%
%{--    });--}%

%{--    setListVisible(true);--}%
%{--    }--}%

%{--    function filterRegions(query) {--}%
%{--    const q = query.trim().toLowerCase();--}%
%{--    if (q.length < 2) {--}%
%{--        clearList();--}%
%{--        return;--}%
%{--    }--}%

%{--    filtered = REGIONS--}%
%{--        .filter(r => r.name.toLowerCase().includes(q))--}%
%{--        .slice(0, 20); // Limit results, like MUI Autocomplete--}%

%{--    activeIndex = -1;--}%
%{--    renderList();--}%
%{--    }--}%

%{--    function highlightActive() {--}%
%{--    const items = list.querySelectorAll('.list-group-item');--}%
%{--    items.forEach((item, idx) => {--}%
%{--        if (idx === activeIndex) {--}%
%{--            item.classList.add('active');--}%
%{--            item.setAttribute('aria-selected', 'true');--}%
%{--            item.scrollIntoView({ block: 'nearest' });--}%
%{--        } else {--}%
%{--            item.classList.remove('active');--}%
%{--            item.removeAttribute('aria-selected');--}%
%{--        }--}%
%{--    });--}%
%{--    }--}%

%{--    function moveActive(delta) {--}%
%{--    if (!filtered.length) return;--}%

%{--    activeIndex += delta;--}%

%{--    if (activeIndex < 0) activeIndex = filtered.length - 1;--}%
%{--    if (activeIndex >= filtered.length) activeIndex = 0;--}%

%{--    highlightActive();--}%
%{--    }--}%

%{--    function selectRegionByIndex(index) {--}%
%{--    if (index < 0 || index >= filtered.length) return;--}%
%{--    const region = filtered[index];--}%

%{--    input.value = region.name;--}%
%{--    clearList();--}%

%{--    // Hook into your existing region selection logic here:--}%
%{--    onRegionSelected(region);--}%
%{--    }--}%

%{--    function onRegionSelected(region) {--}%
%{--    // This is the bridge back into your existing map/region code.--}%
%{--    // Adjust to match *your* function names.--}%
%{--    // Examples:--}%
%{--    //   window.selectRegion(region.id);--}%
%{--    //   window.selectRegionByName(region.name);--}%
%{--    //   window.regionMap.selectRegion(region.id);--}%
%{--    if (typeof window.selectRegion === 'function') {--}%
%{--        window.selectRegion(region.id);--}%
%{--    } else if (typeof window.selectRegionByName === 'function') {--}%
%{--        window.selectRegionByName(region.name);--}%
%{--    } else {--}%
%{--        console.log('Region selected:', region);--}%
%{--    }--}%
%{--    }--}%

%{--    // --- Event handlers -----}%

%{--    input.addEventListener('input', function () {--}%
%{--    filterRegions(input.value);--}%
%{--    });--}%

%{--    input.addEventListener('keydown', function (e) {--}%
%{--    switch (e.key) {--}%
%{--        case 'ArrowDown':--}%
%{--            e.preventDefault();--}%
%{--            moveActive(1);--}%
%{--            break;--}%
%{--        case 'ArrowUp':--}%
%{--            e.preventDefault();--}%
%{--            moveActive(-1);--}%
%{--            break;--}%
%{--        case 'Enter':--}%
%{--            if (filtered.length && activeIndex >= 0) {--}%
%{--                e.preventDefault();--}%
%{--                selectRegionByIndex(activeIndex);--}%
%{--            }--}%
%{--            break;--}%
%{--        case 'Escape':--}%
%{--            clearList();--}%
%{--            break;--}%
%{--    }--}%
%{--    });--}%

%{--    // Close suggestions when focus leaves--}%
%{--    input.addEventListener('blur', function () {--}%
%{--    // Slight delay so click on an item still registers--}%
%{--    setTimeout(clearList, 150);--}%
%{--    });--}%
%{--    })();--}%

</asset:script>
</body>
</html>
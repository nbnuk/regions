<%@ page import="org.grails.encoder.impl.HTMLEncoder" %>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>

    <meta name="breadcrumbParent" content="${grailsApplication.config.getProperty('breadcrumbParent')}"/>
    <meta name="breadcrumbs" content="${g.createLink(uri: '/', absolute: true)},${message(code:"regions.title")}"/>
    <meta name="breadcrumb" content="${region.name}"/>

    <asset:script type="text/javascript">
        var REGION_CONFIG = {
            regionName: '${region.name}',
            regionType: '${region.type}',
            regionFid: '${region.fid}',
            regionPid: '${region.pid}',
            regionLayerName: '${region.layerName}',
            urls: {
                regionsApp: '${g.createLink(uri: '/', absolute: true)}',
                proxyUrl: '${g.createLink(controller: 'proxy', action: 'index')}',
                proxyUrlBbox: '${g.createLink(controller: 'proxy', action: 'bbox')}',
                speciesPageUrl: "${grailsApplication.config.getProperty('bie.baseURL')}/species/",
                biocacheServiceUrl: "${grailsApplication.config.getProperty('biocacheService.baseURL')}",
                biocacheWebappUrl: "${grailsApplication.config.getProperty('biocache.baseURL')}",
                spatialWmsUrl: "${grailsApplication.config.getProperty('geoserver.baseURL')}/ALA/wms?",
                spatialCacheUrl: "${grailsApplication.config.getProperty('geoserver.baseURL')}/gwc/service/wms?",
                spatialServiceUrl: "${grailsApplication.config.getProperty('layersService.baseURL')}/",
            },
            username: '${rg.loggedInUsername()}',
            useGoogleApi: '${(grailsApplication.config.getProperty('google.apikey')) ? "true": ""}',
            contextPath: "${request.contextPath}",
            locale: "${(org.springframework.web.servlet.support.RequestContextUtils.getLocale(request).toString())?:request.locale}",
            q: '${region.q}'
        <g:if test="${enableQueryContext}">
            ,qc: "${grailsApplication.config.getProperty('biocache.queryContext')}"
        </g:if>
            ,hubFilter: "${raw((enableHubData ? grailsApplication.config.getProperty('hub.hubFilter') : '') + grailsApplication.config.getProperty('biocache.filter'))}"
            ,enableHubData: ${enableHubData ?: false}
        <g:if test="${enableHubData}">
            ,showHubData: ${hubState}
        </g:if>
        ,taxa_filter: "${grailsApplication.config.filter?.taxa?: 'rank:(species OR subspecies)'}"
    %{-- if specific theming is defined for the map, mapTheme will contain the legend title, map ENV options and
         optionally a flag to hide the upper range of biocache-generated legend labels.
         Whether the biocache legend or a custom legend will be used is based on whether the ENV options contain colormode.
         If colormode is defined then the legend is drawn from biocache (with arbitrary colours).
         Alternatively, the details of a custom legend are defined in the mapLayers variable, comprising an equal number of
         pipe-delimited entries for each layer FQ, label and colour.
Example .properties file entries:

map.env.legendtitle=Licence

#if using automatic legend from biocache then add colormode and legendhidemaxrange option
#map.env.options=colormode:license,CC-BY,CC-BY-NC,CC0,OGC;name:circle;size:4
#map.env.legendhidemaxrange=true

#if using custom legend add layerfq options, labels and colours (same number of each and | delimited)
#map.env.options=name:circle;size:4
#map.layers.fqs=license:("CC-BY" OR "CC-BY-NC")|license:CC0
#map.layers.labels=CC-BY*|CC0
#map.layers.colours=E6704C|FFC0CB
        --}%
        ,mapTheme: {
            mapEnvOptions: "${grailsApplication.config.map?.env?.options ?: 'color:' + (grailsApplication.config.map?.records?.colour ?: 'e6704c') + ';name:circle;size:4'}",
                mapEnvLegendTitle: "${grailsApplication.config.map?.env?.legendtitle ?: ''}",
                mapEnvLegendHideMax: "${grailsApplication.config.map.env?.legendhidemaxrange?:false}"
            }
            ,mapLayers: {
                mapLayersFqs: "${grailsApplication.config.map?.layers?.fqs ?: ''}",
                mapLayersLabels: "${grailsApplication.config.map?.layers?.labels ?: ''}",
                mapLayersColours: "${grailsApplication.config.map?.layers?.colours ?: ''}"
            }
        ,bbox: {
            sw: {
                lat: ${region.bbox?.minLat},
                lng: ${region.bbox?.minLng}
            },
            ne: {
                lat: ${region.bbox?.maxLat},
                lng: ${region.bbox?.maxLng}
            }
        }
        ,useReflectService: ${useReflect}
            ,enableRegionOverlay: ${enableRegionOverlay != null ? enableRegionOverlay : 'true'}
        };
    </asset:script>

    <meta name="layout" content="${grailsApplication.config.getProperty('skin.layout') ?: 'main'}"/>
    <title>${region.name} | ${grailsApplication.config.getProperty('orgNameLong')}</title>
    <script src="${g.createLink(controller: 'data', action: 'regionsMetadataJavascript')}"></script>

    <script src="https://maps.google.com/maps/api/js?key=${grailsApplication.config.getProperty('google.apikey')}"></script>
    <script src="https://www.gstatic.com/charts/loader.js"></script>

    <asset:stylesheet src="leaflet/leaflet"/>
    <asset:stylesheet src="application"/>
    <asset:javascript src="regions/application"/>
    <asset:javascript src="dependencies.js"/>
    <asset:javascript src="leaflet/leaflet"/>
    <asset:javascript src="regions_app"/>
    <asset:javascript src="region_page"/>
</head>

<body class="nav-locations regions">
<g:set var="enableQueryContext" value="${grailsApplication.config.getProperty('biocache.enableQueryContext')?.toBoolean()}"></g:set>
<g:set var="enableHubData" value="${grailsApplication.config.getProperty('hub.enableHubData')?.toBoolean()}"></g:set>
<g:set var="hubState" value="${true}"></g:set>
<div class="row">
    <div class="col-md-12">
        <div class="pull-right">
            <div class="row">
                <g:if test="${alertsUrl}">
                <a id="alertsButton" class="btn btn-primary btn-ala pull-right" href="${alertsUrl}">
                    <g:message code="alerts.btn" />
                    <i class="icon-bell icon-white"></i>
                </a>
                </g:if>
            </div>
        </div>
    </div>
</div>

<div class="row" id="emblemsContainer">
    <div class="col-md-12">
        <g:if test="${flash.message}">
            <div class="message">${flash.message}</div>
        </g:if>
        <h1>${region.name}</h1>
        <aa:zone id="emblems"
                 href="${g.createLink(controller: 'region', action: 'showEmblems', params: [regionType: region.type, regionName: region.name, regionPid: region.pid])}">
            <i class="fa fa-cog fa-spin fa-2x"></i>
        </aa:zone>
    </div>
</div>

<div class="row">
    <div class="col-md-8">
        <g:if test="${region.description || region.notes}">
            <section class="section">
                <h2><g:message code="region.description" /></h2>
                <g:if test="${region.description}"><p>${raw(region.description)}</p></g:if>
                <g:if test="${region.notes}"><h3><g:message code="notes.on.maplayer" /></h3>

                    <p>${region.notes}</p></g:if>
            </section>
        </g:if>

        <h3 id="occurrenceRecords" class="occurrenceRecordCount"><g:message code="occurrence.records.count" /> <span id="totalRecords"></span></h3>

        <h3 id="speciesCountLabel" class="speciesRecordCount"><g:message code="species.count"/> <span id="speciesCount"></span></h3>
    </div>
    <g:if test="${enableHubData}">
        <div class="switch-padding col-md-4">
            <span class="pull-right">
                <g:message code="hub.toggle" />
                <input type="checkbox" name="hub-toggle" ${hubState ? "" : "checked"}>
            </span>
        </div>
    </g:if>
</div>

<div class="row">
    <div class="col-md-6">
        <ul class="nav nav-tabs" id="explorerTabs">
            <li class="active"><a id="speciesTab" href="#speciesTabContent" data-toggle="tab">
                <g:message code="explore.by.species"/> <i
                    class="fa fa-cog fa-spin fa-lg hidden"></i></a></li>
            <li><a id="taxonomyTab" href="#taxonomyTabContent" data-toggle="tab">
                <g:message code="explore.by.taxonomy"/> <i
                    class="fa fa-cog fa-spin fa-lg hidden"></i></a></li>
        </ul>

        <div class="tab-content">
            <div class="tab-pane active" id="speciesTabContent">
                <table id="groups"
                       tagName="tbody"
                       class="table table-condensed table-hover"
                       aa-href="${g.createLink(controller: 'region', action: 'showGroups', params: [regionFid: region.fid, regionType: region.type, regionName: region.name, regionPid: region.pid])}"
                       aa-js-before="setHubConfig();"
                       aa-js-after="regionWidget.groupsLoaded();"
                       aa-refresh-zones="groupsZone"
                       aa-queue="abort">
                    <thead>
                    <tr>
                        <th class="text-center"><g:message code="explore.by.group"/></th>
                    </tr>
                    </thead>
                    <tbody id="groupsZone" tagName="tbody">
                    <tr class="spinner">
                        <td class="spinner text-center">
                            <i class="fa fa-cog fa-spin fa-2x"></i>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <table class="table table-condensed table-hover" id="species">
                    <thead>
                    <tr>
                        <th colspan="2" class="text-center"><g:message code="species"/></th>
                        <th class="text-right"><g:message code="records"/></th>
                    </tr>
                    </thead>
                    <aa:zone id="speciesZone" tag="tbody" jsAfter="regionWidget.speciesLoaded();">
                        <tr class="spinner">
                            <td colspan="3" class="spinner text-center">
                                <i class="fa fa-cog fa-spin fa-2x"></i>
                            </td>
                        </tr>
                    </aa:zone>
                </table>

                <div id="exploreButtonsZone">

                </div>
            </div>

            <div class="tab-pane" id="taxonomyTabContent">
                <div id="charts">
                    <i class="spinner fa fa-cog fa-spin fa-3x"></i>
                </div>
            </div>
        </div>
    </div>

    <div class="col-md-6">

        <ul class="nav nav-tabs" id="controlsMapTab">
            <li class="active">
                <a href="#"><g:message code="player.title"/> <i class="fa fa-info-circle fa-lg link" id="timeControlsInfo"
                                                     data-content="${g.message(code:'player.help1')}"
                                                     data-placement="right" data-toggle="popover"
                                                     data-original-title="${g.message(code:'player.help2')}"></i></a>
            </li>
        </ul>

        <div id="timeControls" class="text-center">
            <div id="timeButtons">
                <span class="timeControl link" id="playButton" title="${g.message(code:'player.help3')}"
                      alt="${g.message(code:'player.help3')}"></span>
                <span class="timeControl link" id="pauseButton" title="${g.message(code:'player.play')}" alt="${g.message(code:'player.play')}"></span>
                <span class="timeControl link" id="stopButton" title="${g.message(code:'player.stop')}" alt="${g.message(code:'player.stop')}"></span>
                <span class="timeControl link" id="resetButton" title="${g.message(code:'player.reset')}" alt="${g.message(code:'player.reset')}"></span>
            </div>

            <div id="timeSlider">
                <div id="timeRange"><span id="timeFrom"></span> - <span id="timeTo"></span></div>
            </div>
        </div>

        <div>
            <div id="maploading" class="maploading" hidden>
                <div>
                    <i class="spinner fa fa-cog fa-spin fa-3x" style="margin-top:90px"></i>
                </div>
            </div>

            <div id="region-map">
            </div>
            <div id="mapLegend"><table id="mapLegendTable"></table></div>
        </div>

        <div class="pull-right mt-1"><a href="#licenseModal" class="text-danger" data-toggle="modal" data-target="#licenseModal"><i class="fa fa-exclamation-triangle"></i> <g:message code="map.license.title" /></a></div>

        <div class="accordion" id="opacityControls">
            <div class="accordion-group">
                <div class="accordion-heading">
                    <a class="accordion-toggle" data-toggle="collapse" href="#opacityControlsContent">
                        <i class="fa fa-chevron-right"></i>
                        <g:message code="opacity.title"/>
                    </a>
                </div>

                <div id="opacityControlsContent" class="accordion-body collapse">
                    <div class="accordion-inner">
                        <label class="checkbox">
                            <input type="checkbox" name="occurrences" id="toggleOccurrences" checked>
                            <g:message code="opacity.occurrences"/>
                        </label>

                        <div id="occurrencesOpacity"></div>
                        <label class="checkbox">
                            <input type="checkbox" name="region" id="toggleRegion" checked>
                            <g:message code="opacity.regions"/>
                        </label>

                        <div id="regionOpacity"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="mapNote"><g:message code="map.note" /></div>

        <div class="modal fade" id="licenseModal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                        <h4 class="modal-title" id="myModalLabel"><g:message code="map.license.title" /></h4>
                    </div>
                    <div class="modal-body">
                        <g:message code="map.license.content" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<g:if test="${subRegions.size() > 0}">
    <div class="row">
        <div class="col-md-12" id="subRegions">
            <h2><g:message code="subregions.within"/> ${region.name}</h2>
            <g:each in="${subRegions}" var="item">
                <h3>${item.key}</h3>
                <ul>
                    <g:each in="${item.value.list}" var="r">
                        <li><g:link action="region"
                                    params="[regionType: item.value.name, regionName: r, parent: region.name]">${r}</g:link></li>
                    </g:each>
                </ul>
            </g:each>
        </div>
    </div>
</g:if>

</body>
</html>

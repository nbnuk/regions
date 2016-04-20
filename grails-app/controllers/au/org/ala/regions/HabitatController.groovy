package au.org.ala.regions

import groovy.json.JsonSlurper
import groovyx.net.http.*
import static groovyx.net.http.ContentType.*
import static groovyx.net.http.Method.*


class HabitatController {

    def grailsApplication

    def metadataService

    def index = {
        [config : metadataService.getHabitatConfig()]
    }

    /**
     * Takes a habitat ID and constructs a biocache query for one or more habitats.
     *
     * @return
     */
    def viewRecords(){

        def habitatID = params.habitatID

        def habitatsUrl = new URL(grailsApplication.config.bieService.baseURL +  "/habitat/ids/" + habitatID)
        def js = new JsonSlurper()
        def habitats = js.parseText(habitatsUrl.text)

        def fqParam = "("
        def title = ""

        //retrieve child IDs and construct a query
        habitats.searchResults.eachWithIndex { habitat, idx ->
            if(idx > 0){
                fqParam = fqParam + " OR "
                title = title + ", "
            }

            fqParam = fqParam + grailsApplication.config.habitat.layerId + ":\"" + habitat + "\""
            title = title + habitat
        }

        fqParam = fqParam + ")"

        def http = new HTTPBuilder( grailsApplication.config.biocacheService.baseURL + '/webportal/params' )
        http.request( POST, URLENC ) { req ->
            body = [
                q: fqParam,
                title: title
            ]
            response.success = { resp, json ->
                def qid = json.keySet().first()
                redirect(url: grailsApplication.config.biocache.baseURL  + "/occurrences/search?q=qid:" + qid)
            }
        }
    }
}
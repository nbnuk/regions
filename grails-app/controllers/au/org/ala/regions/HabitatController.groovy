package au.org.ala.regions

import groovyx.net.http.*
import static groovyx.net.http.ContentType.*
import static groovyx.net.http.Method.*
import okhttp3.MediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response

class HabitatController {

    def metadataService

    public static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    def index = {
        [config : metadataService.getHabitatConfig()]
    }

    def findNode(node, habitatID){
        log.debug("finding habitat ID: ${habitatID}")
        def nodeToReturn

        if (node.containsKey(habitatID)) {
            nodeToReturn = node.get(habitatID)
        } else {
            for (Map.Entry me : node.entrySet()) {
                nodeToReturn = findNode(node.children, habitatID)
                if (me.getValue().containsKey("children")) {
                    nodeToReturn = findNode(me.getValue().children, habitatID)
                    if (nodeToReturn != null) {
                        break
                    }
                }
            }
        }

        nodeToReturn
    }

    def flattenNode(node){
        def nodes = [node.name]
        node.children.each { key, value ->
            nodes << value.name
        }
        nodes
    }

    /**
     * Takes a habitat ID and constructs a biocache query for one or more habitats.
     *
     * @return
     */
    def viewRecords(){

        def habitatID = params.habitatID
        def config = metadataService.getHabitatConfig()

        //find the node
        def node = findNode(config.tree, habitatID)
        def flattenValues = flattenNode(node)
        def fqParam = "("
        def title = ""

        //retrieve child IDs and construct a query
        flattenValues.eachWithIndex { habitat, idx ->
            if(idx > 0){
                fqParam = fqParam + " OR "
                title = title + ", "
            }

            fqParam = fqParam + grailsApplication.config.getProperty('habitat.layerId') + ":\"" + habitat + "\""
            title = title + habitat
        }

        fqParam = fqParam + ")"

        def http = new HTTPBuilder( grailsApplication.config.biocacheService.baseURL + '/webportal/params' )
        http.request( POST, URLENC ) { req ->
            body = [
                    q: fqParam,
                    fq: "-occurrence_status:absent",
                    title: title
            ]
            response.success = { resp, json ->
                def qid = json.keySet().first()
                redirect(url: grailsApplication.config.biocache.baseURL  + "/occurrences/search?q=qid:" + qid)
            }

        Request request = new Request.Builder()
                    .url(grailsApplication.config.getProperty('biocacheService.baseURL') + '/webportal/params')
                    .post(RequestBody.create([q: fqParam, title: title], JSON))
                    .build()
        try (Response response = client.newCall(request).execute()) {
            def qid = response.body().string()
            redirect(url: grailsApplication.config.getProperty('biocache.baseURL')  + "/occurrences/search?q=qid:" + qid)
        }
    }
}

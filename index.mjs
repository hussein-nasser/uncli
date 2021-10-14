import readline from "readline"
import  fs from "fs";
import { Portal } from "./portal.mjs"
import { UtilityNetwork } from "./utilitynetwork.node.mjs"
import { AdminLog } from "./adminlog.mjs"

import { logger } from "./logger.mjs"
import  fetch  from "node-fetch"
import { DH_NOT_SUITABLE_GENERATOR } from "constants";
//update version
let version = "0.0.60";
const GENERATE_TOKEN_TIME_MIN = 30;

let rl = null;


//uncli --portal https://utilitynetwork.esri.com/portal --service AllStar_oracle --user unadmin --password unadmin.108
let portal = null;
let un  = null;
let adminLog = null;

//parse input for parameters 
function parseInput(){

      const parameters = [ 
          "--portal"  ,
          "--service" ,
          "--user" ,
          "--password",
          "--command",
          "--gdbversion",
          "--file",
          "--verify"
           ]     

      const params = {
          "portal": null,
          "service": null,
          "user": null,
          "password": null,
          "command": "",
          "gdbversion": "SDE.DEFAULT",
          "file": "",
          "verify": "true"
      }

      for (let i = 0; i < process.argv.length ; i++){
            const a = process.argv[i];
            //if the key is found in one of the parameters
           
            if (parameters.includes(a))
                params[a.replace("--","")] = process.argv[i+1]            
      }

      if (Object.values(params).includes(null))
      {
        console.log ("HELP: uncli --portal https://unportal.domain.com/portal --service servicename --user username --password password [--gdbversion* user.version --file commandfile* --verify true|false]")    
        console.log("--file commandfile is optional and you can pass a path to a file with a list of command to execute. ")
        console.log("--gdbversion is optional and allows the UN to be opened in that version. When not specified sde.DEFAULT is used.")
        process.exit();
      }
     
      return params;
}

//
async function getToken(parameters) {
    portal = new Portal(parameters.portal, parameters.user, parameters.password)
    logger.info("About to connect..")
    const token = await portal.connect()
    logger.info(`Token generanted successfully.`)
    return token;
}

async function regenerateToken(parameters) {
    console.log("Regenerating token.")
    const token = await getToken(parameters);
    un.token = token;
    executeInput("clear");
    //generate token every 10 minutes
    setTimeout( async () => await regenerateToken(parameters), 1000*60*GENERATE_TOKEN_TIME_MIN ) 
}


//connect to the service
async function connect(parameters) {
    try{
     //print the parameters
    logger.info(parameters);
    //connect to portal
    
    const token = await getToken(parameters);
    const services = await portal.services();

    //check if the service exists 
    const service = services.services.find(s => s.name === parameters.service)
    if (!service){
        logger.error( `Service ${parameters.service} not found or user don't have permissions to view it`)
        process.exit();
    }

    const serviceUrl =  portal.serverUrl + `/rest/services/${parameters.service}/FeatureServer`
    un = new UtilityNetwork(token, serviceUrl, parameters.gdbversion)
    //create a new admin object (user might not be admin we won't use it until the user call log )
    adminLog = new AdminLog(token, portal.serverUrl)
    logger.info("Loading utility network...")
    await un.load();
    logger.info("Connected.")
    /*test here*/
 
    //if user specified file path open it read all commands and execute them
    const file =parameters.file;
    const command = parameters.command;
    if ( file != "") {
        if (fs.existsSync(file)){
            const commands = fs.readFileSync(file).toString().split(/\r?\n/)
            for (let i = 0; i < commands.length; i++) {
                const c = commands[i];
                //check for new empty lines and skip them
                if (/^\s*$/.test(c)) continue;
                await executeInput(c);
            }
            
        }
        else
            console.error(`Cannot open specified file ${file}.`)
      
    } 
        //execute one off command
        if ( command != "")          
            executeInput(command);
         


        askInput();

        setTimeout( async ()=> await regenerateToken(parameters) , 1000*60*GENERATE_TOKEN_TIME_MIN)
    }
    catch(ex){
        console.error(ex)
        process.exit(1)
    }
}


//list of inputs and commands to execute
const inputs = {
    "^ls$" : async () => {
        const services = await portal.services();
        //make unique
        const uniqueServices = [...new Set(services.services.map(s => s.name))]   
        console.table(uniqueServices)
    },

    "^help$": () => {

        console.table({
            "help": "Displays this help",
            "version": "Displays the version of uncli",
            "ls": "List all services",
            "def": "Show the feature service definition",
            "def --layers" : "List all layers in this service",
            "subnetworks" : "Lists all subnetworks",
            "subnetworks --dirty" : "Lists only dirty subnetworks",
            "subnetworks --deleted" : "Lists dirty and deleted subnetworks",
            "evaluate" : "Evaluate in parallel",
            "trace --subnetwork <subnetwork>": "Traces input subnetwork and returns the time and number of elements returned .",
            "topology" : "Displays the topology status",
            "topology --disable" : "Disable topology",
            "topology --enable" : "Enable topology",
            "topology --validate" : "Validate topology (full extent)",
            "update subnetworks --all": "Update all dirty subnetworks synchronously",
            "update subnetworks --deleted": "Update all deleted dirty subnetworks synchronously",
            "update subnetworks --all --async": "Update all dirty subnetworks asynchronously",          
            "export subnetworks --all": "Export all subnetworks with ACK ",
            "export subnetworks --new": "Export all subnetworks with ACK that haven't been exported ",
            "export subnetworks --deleted": "Export all subnetworks with ACK that are deleted ",
            "count": "Lists the number of rows in all feature layers.",
            "count --system": "Lists the number of rows in system layers.",
            "connect --service": "Connects to the another service",
            "arlogs": "Lists attribute rules execution logs (requires admin)",
            "arlogs --byrule": "Lists attribute rules execution summary by rule (requires admin)",
            "whoami": "Lists the current login info",
            "clear": "Clears this screen",
            "quit": "Exit this program"
                    
        })
    },
    "^whoami$": async () => {
 
        console.log(`${parameters.user}@${parameters.service}@${parameters.gdbversion}`)

    },
    "^def --layers$|^layers$": async () => {
        const layerProperties = [
            "id",
            "name",
            "type",
            "geometryType"
        ]
        let serviceDef = await portal.serviceDef(parameters.service);
         
        serviceDef.layers.forEach (l=> Object.keys(l).forEach (k => !layerProperties.includes(k) ? delete l[k] : ""))  
        console.table(serviceDef.layers)
    },
    "^def$" : async () => {
        //we will only print interesting properties
        const serviceProperties = [
            "currentVersion",
            "hasVersionedData",
            "hasArchivedData",
            "supportsDisconnectedEditing",
            "maxRecordCount",
            "supportsApplyEditsWithGlobalIds",
            "supportsOidReservation",
            "capabilities"
        ]

        let serviceDef = await portal.serviceDef(parameters.service);

        Object.keys(serviceDef).forEach (k => !serviceProperties.includes(k) ? delete serviceDef[k] : "")

        console.table(serviceDef)
    },
    "^subnetworks$": async () => {
        
        const subnetworks = await un.getSubnetworks();
        if (subnetworks.features.length === 0) {
            console.log("No dirty subnetworks found.")
            return;
        }
        const subs = subnetworks.features.map(a => a.attributes)
        console.table(subs)
        const rowCount = subs.length;
        console.log (`${numberWithCommas(rowCount)} rows returned.`)
    },
    "^topology$": async () => {  
        const moments = ["initialEnableTopology","fullValidateTopology","partialValidateTopology","enableTopology","disableTopology","definitionModification","updateIsConnected"]      
        const networkMoments = await un.queryMoment(moments)
       // networkMoments.forEach (m => momentsText += `\n${m.moment} : ${m.time === 0 ? "N/A": new Date(m.time*1000)} ${m.duration === 0 ? "" : ` Duration: ${Math.round(m.duration/1000)}s `} `)
       // networkMoments.forEach (m => momentsText += `\n${m.moment} : ${m.time === 0 ? "N/A": new Date(m.time*1000)} ${m.duration === 0 ? "" : ` Duration: ${Math.round(m.duration/1000)}s `} `)
      //  console.log('\x1b[36m%s\x1b[0m', 'I am cyan');  //cyan
        const topoMoments = networkMoments.networkMoments.map(m => {
            const t = m.time === 0 ? "N/A": new Date(m.time*1000)
            const d = m.duration === 0 ? "N/A" : numberWithCommas(Math.round(m.duration/1000)) + " s"
            m.time = t.toString()
            m.duration = d;
            return m;
        })
        topoMoments.push({
            "moment": "Is Enabled",
            "time": networkMoments.validNetworkTopology ,
            "duration": networkMoments.validNetworkTopology 
        }) 
        console.table(topoMoments) 
    },
    "^topology --enable$": async () => {
        console.log("Enabling topology ...");
        const fromDate = new Date();
        const result = await un.enableTopology()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
        console.table(result) 
    },
    "^topology --disable$": async () => {
        const fromDate = new Date();
        console.log("Disabling topology ...");
        const result = await un.disableTopology()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
        console.table(result) 
    },
    "^evaluate$": async () => {
        const fromDate = new Date();
        console.log("Building Evaluation Blocks ...");
        //return evaluation blocks for layer 5
        const blocks = await buildEvaluationBlocks(5);

        console.log("Evaluating Attribute Rules ...");
        //blocks.forEach(b => un.evaluate (null, b, ["validationRules", "calculationRules"], async = false, gdbVersion = "sde.DEFAULT"))
        //Object.keys(blocks).forEach(k => console.log(blocks[k]))
        const promises = []
        Object.keys(blocks).forEach(k => promises.push(un.evaluate (null, blocks[k], ["validationRules", "calculationRules"] )))
        
        console.log("done sending all requests.. now waiting for response ")
        
        Promise.all(promises).then(a=>console.log("done")).catch(a=>console.log("failed" + JSON.stringify(a)))

        const result = {}
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
        console.log(result)
    },

    //partition so that we can run and commit incrementally.. 
    //progress
    //timeouts
    //in case failure you don't lose everything
    "^topology --validate -fn$": async () => {
        console.log("Validating Network topology ...");

        const fullExtent = un.featureServiceJson.fullExtent;
        /*
        fullExtent.xmin = 0;
        fullExtent.xmax = 100;
        fullExtent.ymin = 0;
        fullExtent.ymax = 100;
        https://desktop.arcgis.com/en/arcmap/10.3/tools/cartography-toolbox/create-cartographic-partitions.htm
        */
        //fish net
        const grids = 4;
        const dx = (fullExtent.xmax - fullExtent.xmin) / grids;
        const dy = (fullExtent.ymax - fullExtent.ymin) / grids;
        
        const extents = [];
        for (let i =0; i < grids; i ++) {
            
            for (let j = 0; j < grids; j++) {
                const extent = {
                    "xmin": fullExtent.xmin + j*dx,
                    "xmax": fullExtent.xmin + j*dx + dx,
                    "ymin": fullExtent.ymin + i*dy,
                    "ymax": fullExtent.ymin + i*dy + dy,
                    "spatialReference": fullExtent.spatialReference
                }
                extents.push(extent);
            }
        }
         
        extents.forEach(async e => {
            const fromDate = new Date(); 

            const result = await un.validateNetworkTopology("sde.DEFAULT", e)
            const toDate = new Date();
            const timeEnable = toDate.getTime() - fromDate.getTime();
            const duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
            console.clear()
            console.log("Validating extent " + e.xmin)
            console.table({duration}) 

        })
        
        
    },

    "^topology --validate$": async () => {
        console.log("Validating Network topology ...");
        const fromDate = new Date();
        const result = await un.validateNetworkTopology()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
        console.table(result) 
    },
    "^subnetworks --dirty$": async () => {        
        const subnetworks = await un.getSubnetworks("isdirty=1");
        if (subnetworks.features.length === 0) {
            console.log("No dirty subnetworks found.")
            return;
        }
            
        const subs = subnetworks.features.map(a => a.attributes)
        console.table(subs)
        const rowCount = subs.length;
        console.log (`${numberWithCommas(rowCount)} rows returned.`)
    },
    "^subnetworks --deleted$": async () => {        
        const subnetworks = await un.getSubnetworks("isdirty=1 and isdeleted=1");
        if (subnetworks.features.length === 0) {
            console.log("No dirty and deleted subnetworks found.")
            return;
        }
            
        const subs = subnetworks.features.map(a => a.attributes)
        console.table(subs)
        const rowCount = subs.length;
        console.log (`${numberWithCommas(rowCount)} rows returned.`)
    },

    "^update subnetworks --deleted$" : async () => {
        console.log("Querying all subnetworks that are dirty and deleted.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=1 and isdeleted=1");
        console.log(`Discovered ${subnetworks.features.length} dirty deleted subnetworks.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            console.log("Updating Subnetwork " + v(f.attributes,"subnetworkName"));
            
            const fromDate = new Date();
             
            
            const subnetworkResult = await un.updateSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            
            //code

            const toDate = new Date();
            const timeEnable = toDate.getTime() - fromDate.getTime();
            subnetworkResult.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
            

            console.log(`Result ${JSON.stringify(subnetworkResult)}`)
        }
    },

    "^update subnetworks --all$" : async () => {
        console.log("Querying all subnetworks that are dirty.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=1");
        console.log(`Discovered ${subnetworks.features.length} dirty subnetworks.`);


        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            console.log("Updating Subnetwork " + v(f.attributes,"subnetworkName"));
            
            const fromDate = new Date();
            

            const subnetworkResult = await un.updateSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            
            const toDate = new Date();
            const timeEnable = toDate.getTime() - fromDate.getTime();
            subnetworkResult.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"

            console.log(`Result ${JSON.stringify(subnetworkResult)}`)
        }
    },
    "^update subnetworks --all --async$" : async () => {
        console.log("Querying all subnetworks that are dirty.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=1");
        console.log(`Discovered ${subnetworks.features.length} dirty subnetworks.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            console.log("Sending job for " + v(f.attributes,"subnetworkName"));
            const subnetworkResult = await un.updateSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),true);
            console.log(`Result from submitting job ${JSON.stringify(subnetworkResult)}`)
        }
    },
    "^export subnetworks --all$" : async input => {

        
        //create folder
        const file = input.match(/-f .*/gm)
        let inputDir = "Exported"
        if (file != null && file.length > 0)
             inputDir = file[0].replace("-f ", "")
        //create directory if doesn't exists
        if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)


        console.log("Querying all subnetworks that are clean.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=0");
        console.log(`Discovered ${subnetworks.features.length} subnetworks that can be exported.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            const subnetworkName = v(f.attributes,"subnetworkName")
            console.log("Exporting subnetworks " + v(f.attributes,"subnetworkName"));
            
            const fromDate = new Date();
            
            const subnetworkResult = await un.exportSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
             
            
            //code

            const toDate = new Date();
            const timeEnable = toDate.getTime() - fromDate.getTime();
            subnetworkResult.duration =  numberWithCommas(Math.round(timeEnable/1000)) + " s"
            

            //fetch the json and write it to disk 
            const subContent = await fetch(subnetworkResult.url);
            //check if the response is 200 only then attempt to parse to json
            //although the response is json, its easier to treat it as text (handle error cases) since we will only write it to disk.
            // if we want to do something with the response then make it json
            const jsonExport = await subContent.text();
            fs.writeFileSync(`${inputDir}/${subnetworkName}.json`, jsonExport)            
           

            console.log(`Result ${JSON.stringify(subnetworkResult)} written to file ${process.cwd()}/${inputDir}/${subnetworkName}.json`)

        }
    },
   

    "^export subnetworks --new --folder .*$|^export subnetworks --new$" : async input => {

        //create folder
        const file = input.match(/--folder .*/gm)
        let inputDir = "Exported"
        if (file != null && file.length > 0)
             inputDir = file[0].replace("--folder ", "")
        //create directory if doesn't exists
        if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)


        console.log("Querying all subnetworks that are clean and not exported.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty = 0 and (LASTACKEXPORTSUBNETWORK is null or LASTACKEXPORTSUBNETWORK < LASTUPDATESUBNETWORK)");
        console.log(`Discovered ${subnetworks.features.length} subnetworks that can be exported.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            const subnetworkName = v(f.attributes,"subnetworkName")
            console.log(`Exporting subnetwork ${subnetworkName}` );
            const subnetworkResult = await un.exportSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            //fetch the json and write it to disk 
            const subContent = await fetch(subnetworkResult.url);
            const jsonExport = await subContent.text();
            fs.writeFileSync(`${inputDir}/${subnetworkName}.json`, JSON.stringify(jsonExport))            

            console.log(`Result ${JSON.stringify(subnetworkResult)} written to file ${process.cwd()}/${inputDir}/${subnetworkName}.json`)
        }

 

    },

    "^ia$": async input => {

        const result = await un.returnInvalidAssociations();
        console.log("Invalid Associations " + JSON.stringify(result))
    },
    "^connect --service": async input =>{

        const inputParam = input.match(/--service .*/gm)
        let serviceName = null;
        if (inputParam != null && inputParam.length > 0)
            serviceName = inputParam[0].replace("--service ", "")
        
        parameters.service = serviceName
        connect(parameters)
    },
    "^trace --subnetwork": async input => {
        //get subnetwork name

        const fromDate = new Date();
       

        const inputParam = input.match(/--subnetwork .*/gm)
        let subnetworkName = null;
        if (inputParam != null && inputParam.length > 0)
            subnetworkName = inputParam[0].replace("--subnetwork ", "")

        console.log(`Tracing subnetwork ${subnetworkName}`);
        const result = await un.subnetworkTraceSimple(subnetworkName)
        if (result == null) {
            console.log(`Subnetwork ${subnetworkName} doesn't exist`);
            return null;
        }
        const toDate = new Date();
        const timeRun = toDate.getTime() - fromDate.getTime();
        const newResult = {}
        newResult.duration =  numberWithCommas(Math.round(timeRun/1000)) + " s"
        newResult.elementsCount = result.traceResults.elements.length;
        console.table(newResult) 

    },
    "^export subnetworks --deleted$" : async input => {

        //create folder
        const file = input.match(/-f .*/gm)
        let inputDir = "Exported"
        if (file != null && file.length > 0)
             inputDir = file[0].replace("-f ", "")
        //create directory if doesn't exists
        if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)


        console.log("Querying all subnetworks that are clean and deleted.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty = 0 and isdeleted=1");
        console.log(`Discovered ${subnetworks.features.length} subnetworks that can be exported.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            const subnetworkName = v(f.attributes,"subnetworkName")
            console.log(`Exporting subnetwork ${subnetworkName}` );
            const subnetworkResult = await un.exportSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            //fetch the json and write it to disk 
            const subContent = await fetch(subnetworkResult.url);
            const jsonExport = await subContent.text();
            fs.writeFileSync(`${inputDir}/${subnetworkName}.json`, JSON.stringify(jsonExport))            

            console.log(`Result ${JSON.stringify(subnetworkResult)} written to file ${process.cwd()}/${inputDir}/${subnetworkName}.json`)
        }

 

    },
    "^cwd$" : async input => {
          

        console.log(process.cwd())
 
     },
 
     "^write --folder.*$": async input => {
           
  
         const file = input.match(/--folder .*/gm)
         const inputDir = file[0].replace("--folder ", "")
         //create directory if doesn't exists
         if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)
         fs.writeFileSync(`${inputDir}/${Math.random()}`, Math.random())
         console.log(inputDir)
   
  
      },


    "^count$": async () => {
        console.log("Querying all layers....")
        const layerProperties = [
            "id",
            "name",
            "type",
            "geometryType"
        ]
        let serviceDef = await portal.serviceDef(parameters.service);
         
        const layerCount = []
        const systemLayers = un.getSystemLayers();
        let totalRows =0;
        serviceDef.layers.forEach (l=> Object.keys(l).forEach (k => !layerProperties.includes(k) ? delete l[k] : ""))  
        //all layers except system ones
        const allLayers = serviceDef.layers.filter(l => l.type === 'Feature Layer' && !systemLayers.find(a=> a.id === l.id ))
  

        for (let i = 0; i < allLayers.length; i++ )      
        {
            const l = allLayers[i]
            logger.info (`getting the count of rows of layer ${l.name} ...`) 
            const result = await un.queryCount(l.id);
            totalRows+=result.count;
            layerCount.push( {
                "layerId": l.id,
                "name": l.name    ,
                "count": numberWithCommas(result.count)
            })
    
        }

 
       
        console.table(layerCount)
        console.log(`Total number of rows in all layers : ${numberWithCommas(totalRows)} .`)
    },

    
    "^count --system$": async () => {
        console.log("Querying all system layers....")
        
        const systemLayers = un.getSystemLayers();
        let totalRows = 0;
 
        const layerCount = []
        for (let i = 0; i < systemLayers.length; i++ )      
        {
            const l = systemLayers[i]
            logger.info (`getting the count of rows of layer ${l.name} ...`) 

            const result = await un.queryCount(l.id);
            
            totalRows+=result.count;
            layerCount.push( {
                "layerId": l.id,
                "name": l.name    ,
                "count": numberWithCommas( result.count)
            })
    
        } 
        
        console.table(layerCount)
        console.log(`Total number of rows in all system layers : ${numberWithCommas(totalRows)} .`)

    },

    "^arlogs$": async () => {
        const topLogCount = 200;
        const pageSize = 10000
        console.log(`Querying attribute rules logs for ${parameters.service} ...`)
        console.log(`Displaying top ${topLogCount} entries only..`)

        let result= await adminLog.query([102003], [parameters.service+ ".MapServer"], topLogCount)
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages)
        
        while (jsonRes.hasMore && allMessages.filter(m => m.message.indexOf("Attribute rule execution complete:") > -1).length < topLogCount )
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} debug entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
            result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime)
            jsonRes = await result.json()
            allMessages = allMessages.concat(jsonRes.logMessages)
        }  


        const arMessages = allMessages
            .filter(m => m.message.indexOf("Attribute rule execution complete:") > -1)
            .map (m =>  JSON.parse(m.message.replace("Attribute rule execution complete:", "")))
            .map( m => {
                m["Elapsed Time (ms)"] =  Math.round(m["Elapsed Time"]*1000000)/1000
               // m["Arcade Evaluation Time:"] = Math.round(m["Arcade Evaluation Time:"]*1000,6)
                //m.ArcadeTime = m["Arcade Evaluation Time:"]
                
                delete  m["Arcade Evaluation Time:"];
                delete  m["Elapsed Time"];
                //delete m ['GlobalID'];
                return m
            })
            .sort( (m1, m2) => m2["Elapsed Time (ms)"]- m1["Elapsed Time (ms)"])
            .slice(0, topLogCount);
        console.table(arMessages)
       
         
    },


    "^arlogs --byrule$": async () => {
        const pageSize = 10000 //maximum messages per page
        logger.info(`Querying attribute rules logs for ${parameters.service} ...`)
        let result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize)
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages)
        
        while (jsonRes.hasMore)
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} debug entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
            result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime)
            jsonRes = await result.json()
            allMessages = allMessages.concat(jsonRes.logMessages)
        }  

        const arMessages = allMessages
            .filter(m => m.message.indexOf("Attribute rule execution complete:") > -1)
            .map (m =>  JSON.parse(m.message.replace("Attribute rule execution complete:", "")))
            .map( m => {
                m["Elapsed Time (ms)"] =  Math.round(m["Elapsed Time"]*1000000)/1000
               // m["Arcade Evaluation Time:"] = Math.round(m["Arcade Evaluation Time:"]*1000,6)
                //m.ArcadeTime = m["Arcade Evaluation Time:"]
                
                delete  m["Arcade Evaluation Time:"];
                delete  m["Elapsed Time"];
                //delete m ['GlobalID'];
                return m
            })
            .sort( (m1, m2) => m2["Elapsed Time (ms)"]- m1["Elapsed Time (ms)"])
            .reduce( ( prev, cur ) => {
                if (prev [cur["Rule name"]] === undefined)
                   { 
                       prev [cur["Rule name"]] =  {
                           "totalTime": 0,
                           "occurrence": 0,
                           "minTime":  Number.MAX_SAFE_INTEGER,
                           "maxTime": -1,
                           "avgTime": 0
                       };
                     }
                
                     prev [cur["Rule name"]].totalTime = prev [cur["Rule name"]].totalTime + cur["Elapsed Time (ms)"]
                      
                     if (cur["Elapsed Time (ms)"] < prev [cur["Rule name"]].minTime )
                        prev [cur["Rule name"]].minTime = cur["Elapsed Time (ms)"];

                    if (cur["Elapsed Time (ms)"] > prev [cur["Rule name"]].maxTime )
                        prev [cur["Rule name"]].maxTime = cur["Elapsed Time (ms)"];
                     
                    prev [cur["Rule name"]].occurrence++
                     
                    prev [cur["Rule name"]].avgTime = prev [cur["Rule name"]].totalTime / prev [cur["Rule name"]].occurrence

                return prev
            }, {})

        const rules = Object.keys(arMessages)
        .map(a => {
                const rule = {}
                rule["Attribute Rule"] = a;
                rule["Total Cost (ms)"] = parseFloat(arMessages[a].totalTime.toFixed(2))
                rule["Average Cost (ms)"] = parseFloat(arMessages[a].avgTime.toFixed(2))
                rule["Max execution time (ms)"] = parseFloat(arMessages[a].maxTime.toFixed(2))
                rule["Min execution time (ms)"] = parseFloat(arMessages[a].minTime.toFixed(2))
                rule["Occurrence"] = arMessages[a].occurrence;
                return rule;
        })
        .sort( (m1, m2) => m2["Total Cost (ms)"] -m1["Total Cost (ms)"])
        console.table(rules)

        const totalARExecution = rules.reduce( (prev, cur) =>  prev + cur["Total Cost (ms)"], 0)
        console.log(`Total time spend executing attribute rules (${Math.round(totalARExecution)} ms) (${Math.round(totalARExecution/1000)} s) (${Math.round(totalARExecution/(1000*60))} m)`)
         
    },

    "^version$": () => console.log(version),
    "^clear$|^cls$": () => console.clear(),
    "^quit$": () => {
        rl.close();
        process.exit();
    },
    "^exit$|^quit$|^bye$": () => {
        if (rl) rl.close();
        process.exit();
    }
    

    
} 



 async function buildEvaluationBlocks(layerId) {
    let offset = 0;
    let recordCount = 2000;
    let maxSOC = 10;
    const globalIds = [];
   
    while(true) {
        const result = await un.query(layerId, `1=1`, undefined, undefined, ["globalId"], "sde.DEFAULT", offset, recordCount)
        console.log(`Processing ${recordCount} rows`)
        //for each assocaition check if its valid
        for (let i = 0 ; i < result.features.length; i++){
            const row = result.features[i]
            globalIds.push(row.attributes.globalid)
        }

        //keep asking if this is true
        if (!result.exceededTransferLimit) break;
        offset+= recordCount;
    }

    const blockSize = parseInt(globalIds.length / maxSOC);
    const blocks = {}
    for (let i = 0; i < maxSOC; i++) {
        blocks[i] = 
        [
          {
            "id": layerId,
            "globalIds": globalIds.slice(i*blockSize, (i+1)*blockSize)
          }
        ]
        
    } 
    return blocks;

 }
 async function executeInput(input) {

    return new Promise( async (resolve, reject) => {
        
        try { 
        //execute regEx against all keys and get the first one that matches
        for (const k of Object.keys(inputs)) {
              
            //execute reg ex
            const regExPassed = new RegExp(k, "i").test(input)
            if (regExPassed)
            {
                //execute command
            await inputs[k](input);
            resolve(`Command ${input} executed successfully.`);
            return;
           }
         

        }
        
        //if none of the keys matched fail.
        reject(`Invalid command ${input}. Type help to get a list of commands`)

        /*
            //find the command and execute it
        if (Object.keys(inputs).includes(input)) 
        {
            await inputs[input]();
            resolve(`Command ${input} executed successfully.`);
        }            
        else
            reject(`Invalid command ${input}. Type help to get a list of commands`)

        */

    }
       catch(ex){
        //fail when unexpected error occured.
        console.error(ex);
        process.exit(1);
       } 
    })
  
 
}

 async function askInput() {
    try{

        if (rl == null) {
        
            setupReadLine();
        }

        rl.question("uncli> ",  async input => {

            const regex = /def \d/gm;
            regex.exec()
            try {

            //execute input
            await executeInput(input)
            }
            catch(ex){
                console.error(`${ex}`);
            }
                         
            askInput();
    
        });
    }
    catch(ex){
        console.error(ex)
        process.exit();
    }
  
}


function numberWithCommas(x) {
   // return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
   return x.toLocaleString()
}

/*
rl.question("What is your name ? ", function(name) {
    rl.question("Where do you live ? ", function(country) {
        console.log(`${name}, is a citizen of ${country}`);
        rl.close();
    });
});
*/
function setupReadLine() {
        
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("close", function() {
        console.log("\nbye");
        process.exit(0);
    });

}

const v = (o, f, vIfNotFound=null) => {
    for (let p in o) 
        if (p.toLowerCase() === f.toLowerCase())
            return o[p];
    return vIfNotFound;
}

let parameters = null;
export async function run (){
    const minVer = "v13.2.0"
    const major = Number(process.version.split(".")[0].replace("v",""))
    
    if (major < 13) { 
        console.error(`Minimum required node js is ${minVer} your version is ${process.version}`)
        process.exit(0);
    }
    console.log(`uncli ${version} is experimental command line utility for basic utility network services. Use as is.`)
    parameters = await parseInput( )
    //set certificate verification 
    const verifyCert = parameters["verify"] === 'true' ? 1 : 0;
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = verifyCert;
    setTimeout( async ()=> await regenerateToken(parameters) , 1000*60*GENERATE_TOKEN_TIME_MIN)
    await connect(parameters)
}




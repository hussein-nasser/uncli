import readline from "readline"
import  fs from "fs";
import { Portal } from "./portal.mjs"
import { UtilityNetwork } from "./utilitynetwork.node.mjs"
import { AdminLog } from "./adminlog.mjs"

import  logger  from "./logger.mjs"
import  fetch  from "node-fetch"
//update version
let version = "0.0.83";
const GENERATE_TOKEN_TIME_MIN = 30;

let rl = null;
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
          "--verify",
          "--server",
          "--proxy"
           ]     
        
      //null marked parmaters are required
      const params = {
          "portal": null,
          "service": null,
          "user": null,
          "password": null,
          "command": "",
          "gdbversion": "SDE.DEFAULT",
          "file": "",
          "verify": "true",
          "server": undefined,
          "proxy": undefined
      }

      for (let i = 0; i < process.argv.length ; i++){
            const a = process.argv[i];
            //if the key is found in one of the parameters
           
            if (parameters.includes(a))
                params[a.replace("--","")] = process.argv[i+1]            
      }

      if (Object.values(params).includes(null))
      {
        logger.info ("HELP: uncli --portal https://unportal.domain.com/portal --service servicename --user username --password password [--gdbversion* user.version --server  https://federatedserver.domain.com/server --file commandfile* --verify true|false] --proxy http://proxyurl:port")    
        logger.info("--file commandfile is optional and you can pass a path to a file with a list of command to execute. ")
        logger.info("--gdbversion is optional and allows the UN to be opened in that version. When not specified sde.DEFAULT is used.")
        logger.info("--server is optional except when there are more than one federated server sites to the portal. If the portal only has one server it will be selected.")
        process.exit();
      }
     
      return params;
}

//
async function getToken(parameters) {
    portal = new Portal(parameters.portal, parameters.user, parameters.password,300, parameters.server)
    logger.info("About to connect..")
    const token = await portal.connect()
    logger.info(`Token generanted successfully.`)
    return token;
}

async function regenerateToken(parameters) {
    logger.info("Regenerating token.")
    const token = await getToken(parameters);
    un.token = token;
    executeInput("clear");
    //generate token every 10 minutes
    setTimeout( async () => await regenerateToken(parameters), 1000*60*GENERATE_TOKEN_TIME_MIN ) 
}


//connect to the service
async function connect(parameters) {
    try{
    
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
            "export subnetworks --all [--folder]": "Export all subnetworks with ACK --folder where exported files are saved",
            "export subnetworks --new [--folder]": "Export all subnetworks with ACK that haven't been exported --folder where exported files are saved",
            "export subnetworks --deleted": "Export all subnetworks with ACK that are deleted ",
            "updateisconnected": "Run update is connected ",
            "versions": "List all versions available to the current logged in user.",
            "versions --summary": "Summary of versions.",
            "versions --unreconciled": "List all versions that haven't been reconciled.",
            "versions --version <version name>": "List the input version info",
            "reconcile --version <version name>": "Reconcile the input version synchronously",
            "reconcile --withpost --version <version name>": "Reconcile & Post the input version synchronously, oldest common ancestor first",
            "reconcile --all": "Reconcile all versions available to the current user synchronously, oldest common ancestor first",
            "reconcile --all --withpost --async": "Reconcile and post all versions available to the current user asynchronously, oldest common ancestor first",
            "reconcile --all --async": "Reconcile all versions available to the current user asynchronously, oldest common ancestor first",
            "count": "Lists the number of rows in all feature layers and tables.",
            "count --system": "Lists the number of rows in system layers.",
            "connect --service": "Connects to the another service",
            "tracelogs --age <minutes>": "Lists utility network trace summary logs for the last x minutes (requires admin)",
            "validatelogs --age <minutes>": "Lists utility network validate summary logs for the last x minutes (requires admin)",
            "updatesubnetworkslog --age <minutes>": "Lists utility network update subnetworks summary logs for the last x minutes (requires admin)",
            "arlogs --age <minutes>": "Lists attribute rules execution logs for the last x minutes  (requires admin)",
            "arlogs --byrule [--minguid --maxguid]": "Lists attribute rules execution summary by rule (requires admin), --maxguid and --minguid show the GUID of the feature",
            "topsql --age <minutes>": "Lists all queries executed in the last x minutes  (requires admin)",

            "whoami": "Lists the current login info",
            "clear": "Clears this screen",
            "quit": "Exit this program"
                    
        })
    },
    "^whoami$": async () => {
 
        logger.info(`${parameters.user}@${parameters.service}@${parameters.gdbversion}`)

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


    
    "^versions --version": async (input) => {

        
        const inputParam = input.match(/--version .*/gm)
        let versionName = null;
        if (inputParam != null && inputParam.length > 0)
            versionName = inputParam[0].replace("--version ", "")


        let versions = await un.versions();
        versions.versions = versions.versions.filter ( v => v.versionName.toString().toUpperCase() == versionName.toUpperCase())


        if (versions.versions.length === 0) {
            logger.info("No versions found.")
            return;
        }
        const subs = versions.versions.sort ( (a,b)=> (a?.commonAncestorDate - b?.commonAncestorDate) ). map( (a) =>  {
                     return  {"versionName": a.versionName, "Id": a.versionId, "guid" : a.versionGuid, "modified": new Date(a.modifiedDate),   "common": a.commonAncestorDate ? new Date( a.commonAncestorDate) : 'N/A' , "reconciled": a.reconcileDate ? new Date(a.reconcileDate) : 'N/A'};
                     }) 

        console.table(subs)
        const rowCount = subs.length;
        logger.info (`${numberWithCommas(rowCount)} rows returned.`)
    },
    

    
    "^versions --unreconciled$": async () => {
        const versions = await un.versions();
        if (versions.versions.length === 0) {
            logger.info("No versions found.")
            return;
        }
 
        const subs = versions.versions.filter( a => a.reconcileDate != null ).sort ( (a,b)=> (a?.commonAncestorDate - b?.commonAncestorDate) ). map( (a) =>  {
                     return  {"versionName": a.versionName, "Id": a.versionId, "guid" : a.versionGuid, "modified": new Date(a.modifiedDate),   "common": a.commonAncestorDate ? new Date( a.commonAncestorDate) : 'N/A' , "reconciled": a.reconcileDate ? new Date(a.reconcileDate) : 'N/A'};
                     }) 

        console.table(subs)
        const rowCount = subs.length;
        logger.info (`${numberWithCommas(rowCount)} rows returned.`)
    },

    "^versions$": async () => {
        const versions = await un.versions();
        if (versions.versions.length === 0) {
            logger.info("No versions found.")
            return;
        }
        const subs = versions.versions.sort ( (a,b)=> (a?.commonAncestorDate - b?.commonAncestorDate) ). map( (a) =>  {
                     return  {"versionName": a.versionName, "Id": a.versionId, "guid" : a.versionGuid, "modified": new Date(a.modifiedDate),   "common": a.commonAncestorDate ? new Date( a.commonAncestorDate) : 'N/A' , "reconciled": a.reconcileDate ? new Date(a.reconcileDate) : 'N/A'};
                     }) 

        console.table(subs)
        const rowCount = subs.length;
        logger.info (`${numberWithCommas(rowCount)} rows returned.`)
    },

    
    "^versions --summary$": async () => {
        /* 
            total versions, 
            total unreconciled versions 
            total versions behind default
        */
        const versions = await un.versions();
        if (versions.versions.length === 0) {
            logger.info("No versions found.")
            return;
        }
        
        const summary = {
            "totalVersions": 0,
            "unreconciledVersions": 0,
            "versionsBehindDefault": 0,
            "defaultMoment": 0
        }

        const defaultVersion = versions.versions.filter(v => v.versionName.toString().toUpperCase() === "SDE.DEFAULT")[0];

        summary.totalVersions = versions.versions.length;

        summary.unreconciledVersions = versions.versions.filter( a => a.reconcileDate != null ).length

        summary.versionsBehindDefault = versions.versions.filter( a => defaultVersion.modifiedDate > a?.commonAncestorDate ).length

        summary.defaultMoment = (new Date(defaultVersion.modifiedDate)).toString()
        console.table(summary) 
    },


    "^reconcile --version": async (input) => {
        
        const inputParam = input.match(/--version .*/gm)
        let versionName = null;
        if (inputParam != null && inputParam.length > 0)
            versionName = inputParam[0].replace("--version ", "")

        let versions = await un.versions();
        versions.versions = versions.versions.filter ( v => v.versionName.toString().toUpperCase() == versionName.toUpperCase())

        if (versions.versions.length ==0 ) 
        {
            logger.info (`Version not found ${versionName}`)
            return;
        }
        for (let v = 0; v < versions.versions.length; v++)
        {   
            if (versions.versions[v].versionName.toString().toUpperCase() === "SDE.DEFAULT") continue;
            if (versions.versions[v].versionName.toString().toUpperCase() == versionName.toUpperCase())  {
                logger.info (`Reconciling version ${versions.versions[v].versionName} ...`)

                const result = await un.reconcile(versions.versions[v].versionGuid, false, false, true, false);
                logger.info(JSON.stringify(result))
                break;
            }
           
        }

        logger.info (`Reconciled ${versionName}`)
    },


    
    "^reconcile --withpost --version": async (input) => {
        
        const inputParam = input.match(/--version .*/gm)
        let versionName = null;
        if (inputParam != null && inputParam.length > 0)
            versionName = inputParam[0].replace("--version ", "")

        let versions = await un.versions()
          versions.versions = versions.versions.filter ( v => v.versionName.toString().toUpperCase() == versionName.toUpperCase())

        if (versions.versions.length ==0 ) 
        {
            logger.info (`Version not found ${versionName}`)
            return;
        }
      
        for (let v = 0; v < versions.versions.length; v++)
        {   
            if (versions.versions[v].versionName.toString().toUpperCase() === "SDE.DEFAULT") continue;
            if (versions.versions[v].versionName.toString().toUpperCase() == versionName.toUpperCase())  {
                logger.info (`Reconciling and Posting version ${versions.versions[v].versionName} Common Ancestor ${new Date(versions.versions[v].commonAncestorDate)} ...`)

                const result = await un.reconcile(versions.versions[v].versionGuid, true, false, true, false);
                logger.info(JSON.stringify(result))
                break;
            }
           
        }   
        logger.info (`Reconciled and Posted ${versionName}.`)
    },


    
    "^reconcile --all$": async () => {
        
        let versions = await un.versions()
        versions.versions = versions.versions.sort ( (a,b)=> (a?.commonAncestorDate - b?.commonAncestorDate) )

        for (let v = 0; v < versions.versions.length; v++)
        {   
            if (versions.versions[v].versionName.toString().toUpperCase() === "SDE.DEFAULT") continue;
                logger.info (`Reconciling version ${versions.versions[v].versionName} Common Ancestor ${new Date(versions.versions[v].commonAncestorDate)} ...`)

            const result = await un.reconcile(versions.versions[v].versionGuid, false, false, true, false);
            logger.info(JSON.stringify(result))
        }   
        const rowCount = versions.versions.length;
        logger.info (`Reconciled ${numberWithCommas(rowCount)} versions.`)
    },

    "^reconcile --all --async$": async () => {
        //async
        let versions = await un.versions()
        versions.versions = versions.versions.sort ( (a,b)=> (a?.commonAncestorDate - b?.commonAncestorDate) )

        for (let v = 0; v < versions.versions.length; v++)
        {   
            if (versions.versions[v].versionName.toString().toUpperCase() === "SDE.DEFAULT") continue;
           logger.info (`Reconciling version ${versions.versions[v].versionName} Common Ancestor ${new Date(versions.versions[v].commonAncestorDate)} ...`)

            const result = await un.reconcile(versions.versions[v].versionGuid, false, false, true, true);
            logger.info(JSON.stringify(result))
        }   
        const rowCount = versions.versions.length;
        logger.info (`Reconciled ${numberWithCommas(rowCount)} versions.`)
    },

      "^reconcile --all --withpost --async$": async () => {
        //async
        let versions = await un.versions()
        versions.versions = versions.versions.sort ( (a,b)=> (a?.commonAncestorDate - b?.commonAncestorDate) )

        for (let v = 0; v < versions.versions.length; v++)
        {   
            if (versions.versions[v].versionName.toString().toUpperCase() === "SDE.DEFAULT") continue;
               logger.info (`Reconciling & Posting version ${versions.versions[v].versionName} Common Ancestor ${new Date(versions.versions[v].commonAncestorDate)} ...`)

            const result = await un.reconcile(versions.versions[v].versionGuid, true, false, true, true);
            logger.info(JSON.stringify(result))
        }   
        const rowCount = versions.versions.length;
        logger.info (`Reconciled & Posted ${numberWithCommas(rowCount)} versions.`)
    },

    "^versions --disconnect$": async () => {
        //disconnect all versions
        const versions = await un.versions();

        for (let v = 0; v < versions.versions.length; v++)
        {   
            if (versions.versions[v].versionName.toString().toUpperCase() === "SDE.DEFAULT") continue;
            logger.info (`Stopping editing on version ${versions.versions[v].versionName} ...`)
            const g = versions.versions[v].versionGuid
            let result = await un.stopEditing(g,g);
            logger.info(JSON.stringify(result))
            logger.info (`Stopping reading on version ${versions.versions[v].versionName} ...`)
            result = await un.stopReading(g,g);
            logger.info(JSON.stringify(result))
        }   
        const rowCount = versions.versions.length;
        logger.info (`Disconnected ${numberWithCommas(rowCount)} versions.`)
    },
    "^subnetworks$": async () => {
        
        const subnetworks = await un.getSubnetworks();
        if (subnetworks.features.length === 0) {
            logger.info("No dirty subnetworks found.")
            return;
        }
        const subs = subnetworks.features.map(a => a.attributes)
        console.table(subs)
        const rowCount = subs.length;
        logger.info (`${numberWithCommas(rowCount)} rows returned.`)
    },
    "^topology$": async () => {  
        const moments = ["initialEnableTopology","fullValidateTopology","partialValidateTopology","enableTopology","disableTopology","definitionModification","updateIsConnected"]      
        const networkMoments = await un.queryMoment(moments)
       // networkMoments.forEach (m => momentsText += `\n${m.moment} : ${m.time === 0 ? "N/A": new Date(m.time*1000)} ${m.duration === 0 ? "" : ` Duration: ${Math.round(m.duration/1000)}s `} `)
       // networkMoments.forEach (m => momentsText += `\n${m.moment} : ${m.time === 0 ? "N/A": new Date(m.time*1000)} ${m.duration === 0 ? "" : ` Duration: ${Math.round(m.duration/1000)}s `} `)
      //  logger.info('\x1b[36m%s\x1b[0m', 'I am cyan');  //cyan
        const topoMoments = networkMoments.networkMoments.map(m => {
            const t = m.time === 0 ? "N/A": new Date(m.time*1000)
            const d = m.duration === 0 ? "N/A" : numberWithCommas(Math.round(m.duration)) + " ms"
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
        logger.info("Enabling topology ...");
        const fromDate = new Date();
        const result = await un.enableTopology()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
        console.table(result) 
    },
    "^topology --disable$": async () => {
        const fromDate = new Date();
        logger.info("Disabling topology ...");
        const result = await un.disableTopology()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
        console.table(result) 
    },
    
    "^updateisconnected$": async () => {
        const fromDate = new Date();
        logger.info("Updating is connected ...");
        const result = await un.updateIsConnected()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
        console.table(result) 
    },
    "^evaluate$": async () => {
        const fromDate = new Date();
        logger.info("Building Evaluation Blocks ...");
        //return evaluation blocks for layer 5
        const blocks = await buildEvaluationBlocks(5);

        logger.info("Evaluating Attribute Rules ...");
        //blocks.forEach(b => un.evaluate (null, b, ["validationRules", "calculationRules"], async = false, gdbVersion = "sde.DEFAULT"))
        //Object.keys(blocks).forEach(k => logger.info(blocks[k]))
        const promises = []
        Object.keys(blocks).forEach(k => promises.push(un.evaluate (null, blocks[k], ["validationRules", "calculationRules"] )))
        
        logger.info("done sending all requests.. now waiting for response ")
        
        Promise.all(promises).then(a=>logger.info("done")).catch(a=>logger.info("failed" + JSON.stringify(a)))

        const result = {}
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
        logger.info(result)
    },

    //partition so that we can run and commit incrementally.. 
    //progress
    //timeouts
    //in case failure you don't lose everything
    "^topology --validate --fishnet$": async () => {
        logger.info("Validating Network topology ...");

        const fullExtent = un.layerDefinition.extent;
        //console.log(`add_env(${ JSON.stringify(fullExtent)})`)

        /*
        fullExtent.xmin = 0;
        fullExtent.xmax = 100;
        fullExtent.ymin = 0;
        fullExtent.ymax = 100;
        https://desktop.arcgis.com/en/arcmap/10.3/tools/cartography-toolbox/create-cartographic-partitions.htm
        */
        //fish net
        const grids = 5; //divide the grid 5 x 5
        const dx = (fullExtent.xmax - fullExtent.xmin) / grids;
        const dy = (fullExtent.ymax - fullExtent.ymin) / grids;
         
        const fishnet = [];
        for (let i =0; i < grids; i ++) {
            const row = [];

            for (let j = 0; j < grids; j++) {
                const extent = {
                    "xmin": fullExtent.xmin + j*dx,
                    "xmax": fullExtent.xmin + j*dx + dx,
                    "ymin": fullExtent.ymin + i*dy,
                    "ymax": fullExtent.ymin + i*dy + dy,
                    "spatialReference": fullExtent.spatialReference
                }
                row.push({"content": " ", "extent": extent});
 
            }
            fishnet.push(row);
        }
         


        for (let i = 0; i < fishnet.length; i ++) {

            for (let j = 0 ; j < fishnet[i].length; j++) {
                
                fishnet[i][j].content = '*'
                const e =  fishnet[i][j].extent
            
                    try {

                
                    const fromDate = new Date(); 
                    console.log("Validating Extent " + JSON.stringify(e));
                    printFishnet(fishnet)

                    const result = await un.validateNetworkTopology(  e)
                    const toDate = new Date();
                    const timeEnable = toDate.getTime() - fromDate.getTime();
                    const duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
                    result.duration = duration
                    console.table(result) 
                    //console.log(`add_env(${ JSON.stringify(e)})`)
                    fishnet[i][j].content = 'x'

                    }
                    catch(ex){
                        console.log(JSON.stringify(ex))
                    }

        }
                
    }
    console.log("Done")

    },

    "^topology --validate$": async () => {
        logger.info("Validating Network topology ...");
        const fromDate = new Date();
        const result = await un.validateNetworkTopology()
        const toDate = new Date();
        const timeEnable = toDate.getTime() - fromDate.getTime();
        result.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
        console.table(result) 
    },
    "^subnetworks --dirty$": async () => {        
        const subnetworks = await un.getSubnetworks("isdirty=1");
        if (subnetworks.features.length === 0) {
            logger.info("No dirty subnetworks found.")
            return;
        }
            
        const subs = subnetworks.features.map(a => a.attributes)
        console.table(subs)
        const rowCount = subs.length;
        logger.info (`${numberWithCommas(rowCount)} rows returned.`)
    },
    "^subnetworks --deleted$": async () => {        
        const subnetworks = await un.getSubnetworks("isdirty=1 and isdeleted=1");
        if (subnetworks.features.length === 0) {
            logger.info("No dirty and deleted subnetworks found.")
            return;
        }
            
        const subs = subnetworks.features.map(a => a.attributes)
        console.table(subs)
        const rowCount = subs.length;
        logger.info (`${numberWithCommas(rowCount)} rows returned.`)
    },

    "^update subnetworks --deleted$" : async () => {
        logger.info("Querying all subnetworks that are dirty and deleted.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=1 and isdeleted=1","domainnetworkname,tiername,subnetworkname");
        logger.info(`Discovered ${subnetworks.features.length} dirty deleted subnetworks.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            logger.info("Updating Subnetwork " + v(f.attributes,"subnetworkName"));
            
            const fromDate = new Date();
              
            const subnetworkResult = await un.updateSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            
            //code

            const toDate = new Date();
            const timeEnable = toDate.getTime() - fromDate.getTime();
            subnetworkResult.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
            

            logger.info(`Result ${JSON.stringify(subnetworkResult)}`)
        }
    },

    "^update subnetworks --all$" : async input => {
 
        let subnetworks;
        let more = false;
        let failedSubnetworks = []
        do  {

            let sort = "asc";
            if (input.indexOf("--desc") > 0) sort = "desc"
            let failedSubWhereClause = ""
            
            if (failedSubnetworks.length > 0 )
                failedSubWhereClause = " AND SUBNETWORKNAME NOT IN (" + failedSubnetworks.join(",") + ")"

            logger.info("Querying all subnetworks that are dirty.");
            subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=1 " + failedSubWhereClause, `domainnetworkname  ${sort},tiername ${sort},subnetworkname ${sort}`);
            logger.info(`Discovered ${subnetworks.features.length} dirty subnetworks.`);

            for (let i = 0;  i < subnetworks.features.length; i++) {
                const f = subnetworks.features[i]
                const subnetworkName = v(f.attributes,"subnetworkName")
                logger.info("Updating Subnetwork " + subnetworkName);
                
                const fromDate = new Date();
                 
                const subnetworkResult = await un.updateSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
                //check if we have processed this subnetwork (maybe be an error)
                const tier = un.getTier(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"))
                if (subnetworkResult.success == false || tier.manageSubnetwork?.propertySetItems?.includes("IsDirty"))
                    failedSubnetworks.push("'" + subnetworkName + "'")

                const toDate = new Date();
                const timeEnable = toDate.getTime() - fromDate.getTime();
                subnetworkResult.duration =  numberWithCommas(Math.round(timeEnable)) + " ms"
    
                logger.info(`Result ${JSON.stringify(subnetworkResult)}`)
            }

        } 
        while (subnetworks.features.length > 0)
        
    },
    "^update subnetworks --all --async$" : async () => {
        logger.info("Querying all subnetworks that are dirty.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=1", "domainnetworkname,tiername,subnetworkname");
        logger.info(`Discovered ${subnetworks.features.length} dirty subnetworks.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            logger.info("Sending job for " + v(f.attributes,"subnetworkName"));
            const subnetworkResult = await un.updateSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),true);
            logger.info(`Result from submitting job ${JSON.stringify(subnetworkResult)}`)
        }
    },
   "^export subnetworks --all --folder .*$|^export subnetworks --all$" : async input => {
 
        let subnetworks 
        let sort = "asc";
        if (input.indexOf("--desc") > 0) sort = "desc"
        //create folder
        const file = input.match(/--folder .*/gm)
        let inputDir = "Exported"
        if (file != null && file.length > 0)
             inputDir = file[0].replace("--folder ", "")
        //create directory if doesn't exists
        if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)
        let exportedSubnetworks = [];

        do {

            let exportedSubnetworksWhereClause = ""
            
            if (exportedSubnetworks.length > 0 )
                exportedSubnetworksWhereClause = " AND SUBNETWORKNAME NOT IN (" + exportedSubnetworks.join(",") + ")"
 
            logger.info("Querying all subnetworks that are clean.");
            subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty=0 " + exportedSubnetworksWhereClause,`domainnetworkname  ${sort},tiername ${sort},subnetworkname ${sort}`);
            logger.info(`Discovered ${subnetworks.features.length} subnetworks that can be exported.`);
            for (let i = 0;  i < subnetworks.features.length; i++) {
                const f = subnetworks.features[i]
                const subnetworkName = v(f.attributes,"subnetworkName")
                logger.info("Exporting subnetworks " + v(f.attributes,"subnetworkName"));
                
                const fromDate = new Date();
                
                const subnetworkResult = await un.exportSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
                  
                //code
                exportedSubnetworks.push("'" + v(f.attributes,"subnetworkName") + "'")

                const toDate = new Date();
                const timeEnable = toDate.getTime() - fromDate.getTime();
                subnetworkResult.duration =  numberWithCommas(timeEnable) + " ms"
                //if undefined exit
                if (!subnetworkResult.url)
                {
                    logger.info("Export subnetwork failed " + JSON.stringify(subnetworkResult))
                    continue;
                }

    
                //fetch the json and write it to disk 
                const subContent = await fetch(subnetworkResult.url);
                //check if the response is 200 only then attempt to parse to json
                //although the response is json, its easier to treat it as text (handle error cases) since we will only write it to disk.
                // if we want to do something with the response then make it json
                const jsonExport = await subContent.text();
                fs.writeFileSync(`${inputDir}/${subnetworkName}.json`, jsonExport)            
               
    
                logger.info(`Result ${JSON.stringify(subnetworkResult)} written to file ${process.cwd()}/${inputDir}/${subnetworkName}.json`)
    
            }
        }
        while (subnetworks?.features?.length > 0)
       
    },
   

    "^export subnetworks --new --folder .*$|^export subnetworks --new$" : async input => {

        //create folder
        const file = input.match(/--folder .*/gm)
        let inputDir = "Exported"
        if (file != null && file.length > 0)
             inputDir = file[0].replace("--folder ", "")
        //create directory if doesn't exists
        if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)


        logger.info("Querying all subnetworks that are clean and not exported.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty = 0 and (LASTACKEXPORTSUBNETWORK is null or LASTACKEXPORTSUBNETWORK < LASTUPDATESUBNETWORK)","domainnetworkname,tiername,subnetworkname");
        logger.info(`Discovered ${subnetworks.features.length} subnetworks that can be exported.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            const subnetworkName = v(f.attributes,"subnetworkName")
            logger.info(`Exporting subnetwork ${subnetworkName}` );
            const subnetworkResult = await un.exportSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            //fetch the json and write it to disk 
            const subContent = await fetch(subnetworkResult.url);
            const jsonExport = await subContent.text();
            fs.writeFileSync(`${inputDir}/${subnetworkName}.json`, JSON.stringify(jsonExport))            

            logger.info(`Result ${JSON.stringify(subnetworkResult)} written to file ${process.cwd()}/${inputDir}/${subnetworkName}.json`)
        }

 

    },

    "^ia$": async input => {

        const result = await un.returnInvalidAssociations();
        logger.info("Invalid Associations " + JSON.stringify(result))
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
        try {

             
        const fromDate = new Date();
        const inputDir= "Exported"
        let full = true;
      //  if (input.indexOf("--full") > 0) full = true

        const inputParam = input.match(/--subnetwork .*/gm)
        let subnetworkName = null;
        if (inputParam != null && inputParam.length > 0)
            subnetworkName = inputParam[0].replace("--subnetwork ", "")

        logger.info(`Tracing subnetwork ${subnetworkName}`);
        const result = await un.subnetworkTraceSimple(subnetworkName)
        if (result == null) {
            logger.info(`Subnetwork ${subnetworkName} doesn't exist`);
            return null;
        }
        const toDate = new Date();
        const timeRun = toDate.getTime() - fromDate.getTime();
        const newResult = {}
        newResult.duration =  numberWithCommas(Math.round(timeRun)) + " ms"
        newResult.elementsCount = result.traceResults.elements.length;
        const traceRes = {}
        logger.info("Grouping trace results...")
         result.traceResults.elements.forEach(e => {
            const layerid = un.getLayerIdfromSourceId(e.networkSourceId).layerId
            if (!traceRes["l" + layerid])
                traceRes["l" + layerid] = []
            traceRes["l" + layerid].push(e.objectId)
          
        })
        console.table(newResult)

        //if the trace is full turn around the pull all features
        if (full){

            //loop through all layers and query
            logger.info("Removing duplicates")
                
            console.log(traceRes)
             
            //send all queries async 
            const allQueries = []
            Object.keys(traceRes).forEach (k => {
                traceRes[k] = [...new Set(traceRes[k])]
                allQueries.push(un.query(k.replace("l",""), "", k, traceRes[k]))
            })
            logger.info(`${Object.keys(traceRes)} queries sent, waiting for response..`)
            const result = await Promise.all(allQueries)
            logger.info("All queries returned.")
            fs.writeFileSync(`${inputDir}/traceout${subnetworkName}.json`, JSON.stringify(result))
            logger.info(`Result written to file ${inputDir}/traceout${subnetworkName}.json`)

            //logger.info(JSON.stringify(result))
            
        }
    }
        catch(ex){
            logger.error(JSON.stringify(ex))
        }
    },
    "^export subnetworks --deleted$" : async input => {

        //create folder
        const file = input.match(/-f .*/gm)
        let inputDir = "Exported"
        if (file != null && file.length > 0)
             inputDir = file[0].replace("-f ", "")
        //create directory if doesn't exists
        if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)


        logger.info("Querying all subnetworks that are clean and deleted.");
        let subnetworks = await un.queryDistinct(500002, "domainnetworkname,tiername,subnetworkname", "isdirty = 0 and isdeleted=1");
        logger.info(`Discovered ${subnetworks.features.length} subnetworks that can be exported.`);
        for (let i = 0;  i < subnetworks.features.length; i++) {
            const f = subnetworks.features[i]
            const subnetworkName = v(f.attributes,"subnetworkName")
            logger.info(`Exporting subnetwork ${subnetworkName}` );
            const subnetworkResult = await un.exportSubnetworks(v(f.attributes,"domainNetworkName"), v(f.attributes,"tierName"), v(f.attributes,"subnetworkName"),false);
            
            //if undefined exit
            if (!subnetworkResult.url)
            {
                logger.info("Export subnetwork failed " + JSON.stringify(subnetworkResult))
                continue;
            }

            //fetch the json and write it to disk 
            const subContent = await fetch(subnetworkResult.url);
            const jsonExport = await subContent.text();
            fs.writeFileSync(`${inputDir}/${subnetworkName}.json`, JSON.stringify(jsonExport))            

            logger.info(`Result ${JSON.stringify(subnetworkResult)} written to file ${process.cwd()}/${inputDir}/${subnetworkName}.json`)
        }

 

    },
    "^cwd$" : async input => {
          

        logger.info(process.cwd())
 
     },
 
     "^write --folder.*$": async input => {
           
  
         const file = input.match(/--folder .*/gm)
         const inputDir = file[0].replace("--folder ", "")
         //create directory if doesn't exists
         if (!fs.existsSync(inputDir))  fs.mkdirSync(inputDir)
         fs.writeFileSync(`${inputDir}/${Math.random()}`, Math.random())
         logger.info(inputDir)
   
  
      },


    "^count$": async () => {
        logger.info("Querying all layers....")
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
        let allLayers = serviceDef.layers.filter(l => l.type === 'Feature Layer' && !systemLayers.find(a=> a.id === l.id ))
        allLayers = allLayers.concat(serviceDef.tables);

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
        logger.info(`Total number of rows in all layers : ${numberWithCommas(totalRows)} .`)
    },

    
    "^count --system$": async () => {
        logger.info("Querying all system layers....")
        
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
        logger.info(`Total number of rows in all system layers : ${numberWithCommas(totalRows)} .`)

    },

    "^arlogs --age": async input => {
        const topLogCount = 200;
        const pageSize = 10000

        
        const inputParam = input.match(/--age .*/gm)
        let mins = 30;  //query logs for the last 30 minutes
        if (inputParam != null && inputParam.length > 0)
            mins = inputParam[0].replace("--age ", "")


       logger.info(`Querying attribute rules logs for ${parameters.service} for the last ${mins} minutes ...`)

       const startTime = Date.now() - mins*60*1000
       const endTime = Date.now();

        let result= await adminLog.query([102003], [parameters.service+ ".MapServer"], topLogCount, startTime, endTime , "DEBUG")
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages)
        
        while (jsonRes.hasMore  )
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} debug entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
            result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime)
            jsonRes = await result.json()
            allMessages = allMessages.concat(jsonRes.logMessages)
        }  


        const arMessages = allMessages
            .filter(m => m.message.indexOf("Attribute rule execution complete:") > -1)
            .map (m =>  JSON.parse(decodeHTMLEntities(m.message.replace("Attribute rule execution complete:", ""))))
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

 
    
    "^tracelogs --age": async input => {
        const topLogCount = 1000;
        const pageSize = 10000

        const inputParam = input.match(/--age .*/gm)
        let mins = 30;  //query logs for the last 30 minutes
        if (inputParam != null && inputParam.length > 0)
            mins = inputParam[0].replace("--age ", "")
 
        logger.info(`Querying trace logs for ${parameters.service} for the last ${mins} minutes ...`)
        const startTime = Date.now() - mins*60*1000
        const endTime = Date.now();
        let result= await adminLog.query([102002], [parameters.service+ ".MapServer"], topLogCount, startTime ,endTime , "VERBOSE")
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages) 
        allMessages = allMessages.filter(m => m.message.indexOf("------ Trace Parameters ----") > -1)
        while (jsonRes.hasMore)
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
            result= await adminLog.query([102002], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime, null, "VERBOSE")
            jsonRes = await result.json()
  
            allMessages = allMessages.concat(jsonRes.logMessages.filter(m => m.message.indexOf("------ Trace Parameters ----") > -1))
        }  

        allMessages = allMessages.map(m => {
            const newMessage = Object.assign({}, m);
            delete newMessage.source;
            delete newMessage.machine;
            delete newMessage.type;
            delete newMessage.code;
            delete newMessage.requestID;
            delete newMessage.process;
            delete newMessage.thread;
            newMessage.elapsedms = parseInt (parseFloat(newMessage.elapsed) * 1000)
            newMessage.time = new Date(newMessage.time).toLocaleString()
            delete newMessage.elapsed
             return newMessage;
        })
        .sort( (m1,m2) => m2.elapsedms - m1.elapsedms)

        const summaryMessages = allMessages.map(m => {const newM = Object.assign({}, m); delete newM.message; return newM})
        console.table(summaryMessages)

        allMessages.forEach(m => {
            const newMessage = Object.assign({}, m);
            delete newMessage.message
         
            console.table([newMessage])
            logger.info(m.message)  
        })
         
    },


    "^reconcilelogs --age" : async input => {
        const topLogCount = 1000;
        const pageSize = 10000

        const inputParam = input.match(/--age .*/gm)
        let mins = 30;  //query logs for the last 30 minutes
        if (inputParam != null && inputParam.length > 0)
            mins = inputParam[0].replace("--age ", "")

      
        reconcileLogs(mins,  parameters.service)
        
    },
    "^validatelogs --age": async input => {
      
        const topLogCount = 1000;
        const pageSize = 10000

        const inputParam = input.match(/--age .*/gm)
        let mins = 30;  //query logs for the last 30 minutes
        if (inputParam != null && inputParam.length > 0)
            mins = inputParam[0].replace("--age ", "")
 
            
  logger.info(`Querying validate logs for ${parameters.service} for the last ${mins} minutes ...`)
  const startTime = Date.now() - mins*60*1000
  const endTime = Date.now();
  let result= await adminLog.query([102003], [parameters.service+ ".MapServer"], topLogCount, startTime ,endTime , "VERBOSE")
  let jsonRes = await result.json()
  let allMessages = [].concat(jsonRes.logMessages) 
  allMessages = allMessages.filter(m => m.message.indexOf("-------- Environment ---") > -1 && m.message.indexOf("The network is built.") > -1 && m.methodName == 'BuildEngineLog')
  while (jsonRes.hasMore)
  {  
      //start paging
      logger.info(`Aggregating messages... total so far ${allMessages.length} entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
      let services = [parameters.service + ".MapServer"]
      result= await adminLog.query([102003], services, pageSize, jsonRes.endTime, null, "VERBOSE")
      jsonRes = await result.json()

      allMessages = allMessages.concat(jsonRes.logMessages.filter(m => m.message.indexOf("-------- Environment ---") > -1 && m.message.indexOf("------ Trace Parameters ----") == -1))
  }  



   
  //validate logs missing elapsed populate it
  allMessages = allMessages.map( m => {
      try{
          
          //The network is built. 0.093 seconds (4.982 total) - 29 MB memory

      let re = /The network is built. [-+]?([0-9]*\.[0-9]+|[0-9]+) seconds \([-+]?([0-9]*\.[0-9]+|[0-9]+) total\)/;
      let res = re.exec(m.message)
      if (res && res.length  > 1)
          m.elapsed = res[2]
      
          return m;
      }
      catch(ex){
          return m;
      }
  })

    
         
        allMessages = allMessages.map(m => {
            const newMessage = Object.assign({}, m);
            delete newMessage.source;
            delete newMessage.machine;
            delete newMessage.type;
            delete newMessage.code;
            delete newMessage.requestID;
            delete newMessage.process;
            delete newMessage.thread;
            newMessage.elapsedms = parseInt (parseFloat(newMessage.elapsed) * 1000)
            newMessage.time = new Date(newMessage.time).toLocaleString()
            delete newMessage.elapsed
             return newMessage;
        })
        .sort( (m1,m2) => m2.elapsedms - m1.elapsedms)

        const summaryMessages = allMessages.map(m => {const newM = Object.assign({}, m); delete newM.message; return newM})
        console.table(summaryMessages)

        allMessages.forEach(m => {
            const newMessage = Object.assign({}, m);
            delete newMessage.message
         
            console.table([newMessage])
            logger.info(m.message)  
        })
         


    },



    
    "^updatesubnetworkslogs --age": async input => {
        const topLogCount = 1000;
        const pageSize = 10000

        const inputParam = input.match(/--age .*/gm)
        let mins = 30;  //query logs for the last 30 minutes
        if (inputParam != null && inputParam.length > 0)
            mins = inputParam[0].replace("--age ", "")
 
        logger.info(`Querying subnetwork logs for ${parameters.service} for the last ${mins} minutes ...`)
        const startTime = Date.now() - mins*60*1000
        const endTime = Date.now();
        let result= await adminLog.query([102003], [parameters.service+ ".MapServer"], topLogCount, startTime ,endTime , "VERBOSE")
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages) 
        allMessages = allMessages.filter(m => m.message.indexOf("---- Subnetwork Parameters ----") > -1)
        while (jsonRes.hasMore)
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
            result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime, null, "VERBOSE")
            jsonRes = await result.json()
  
            allMessages = allMessages.concat(jsonRes.logMessages.filter(m => m.message.indexOf("---- Subnetwork Parameters ----") > -1))
        }  
        
        
        
        //update subnetwork missing elapsed populate it
        allMessages = allMessages.map( m => {
            try{
 
            let re = /Total \([-+]?([0-9]*\.[0-9]+|[0-9]+) seconds\)/;
            let res = re.exec(m.message)
            if (res && res.length  > 1)
                m.elapsed = res[1]

            re = /Total update subnetwork time \([-+]?([0-9]*\.[0-9]+|[0-9]+) seconds\)/;
            res = re.exec(m.message)
            if (res && res.length  > 1)
                m.elapsed = res[1]
            
            return m;
            }
            catch(ex){
                return m;
            }
        })


        allMessages = allMessages.map(m => {
            const newMessage = Object.assign({}, m);
            delete newMessage.source;
            delete newMessage.machine;
            delete newMessage.type;
            delete newMessage.code;
            delete newMessage.requestID;
            delete newMessage.process;
            delete newMessage.thread;
            newMessage.elapsedms = parseInt (parseFloat(newMessage.elapsed) * 1000)
            newMessage.time = new Date(newMessage.time).toLocaleString()
            delete newMessage.elapsed
             return newMessage;
        })
        .sort( (m1,m2) => m2.elapsedms - m1.elapsedms)

        const summaryMessages = allMessages.map(m => {const newM = Object.assign({}, m); delete newM.message; return newM})
        console.table(summaryMessages)

        allMessages.forEach(m => {
            const newMessage = Object.assign({}, m);
            delete newMessage.message
         
            console.table([newMessage])
            logger.info(m.message)  
        })
         
         
    },


    
    "^topsql --age": async input => {
        const topLogCount = 1000;
        const pageSize = 10000

        const inputParam = input.match(/--age .*/gm)
        let mins = 30;  //query logs for the last 30 minutes
        if (inputParam != null && inputParam.length > 0)
            mins = inputParam[0].replace("--age ", "")
 
        logger.info(`Querying cursor sql logs for ${parameters.service} for the last ${mins} minutes ...`)
        const startTime = Date.now() - mins*60*1000
        const endTime = Date.now();
        let result= await adminLog.query([102023], [parameters.service+ ".MapServer"], topLogCount, startTime ,endTime , "DEBUG")
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages) 
        allMessages = allMessages.filter(m => m.message.indexOf("EndCursor;") > -1)
        while (jsonRes.hasMore)
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
            result= await adminLog.query([102023], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime, null, "DEBUG")
            jsonRes = await result.json()
  
            allMessages = allMessages.concat(jsonRes.logMessages.filter(m => m.message.indexOf("EndCursor;") > -1))
        }
      logger.info ("Filtering messages...")
      
      allMessages = allMessages
            .map( m=> {
                m.dataAccessElapsed = parseFloat(m.message.split(";")[1].split(" ")[1])
                m.executeQueryElapsed = parseFloat(m.message.split(";")[2].split(" ")[1])
                m.totalExecutionElapsed = m.dataAccessElapsed +  m.executeQueryElapsed 
                m.elapsed = parseFloat(m.elapsed); return m;

            })
            .sort( (m1,m2) => m2.totalExecutionElapsed - m1.totalExecutionElapsed)
            .slice(0, 10) ;//first 10
    
     
        logger.info("-----Top 10 SQL----")
        let i =0;
        allMessages= allMessages.forEach(m => 
            {
             
                const x = m.message.split(";")
                x.shift()
                logger.info(`id: ${i++}`)
                logger.info(`\tAt: ${new Date(m.time)} (${m.time})`)
                logger.info(`\tUser: ${m.user}`)
                logger.info(`\tTotal Time: ${numberWithCommas(Math.round(m.elapsed*1000))} ms (Total time the cursor was opened)`)
                logger.info(`\tQuery Time: ${numberWithCommas(m.totalExecutionElapsed)} ms (includes search + data access nextRow)`)
                logger.info(`\tQuery:`)
                x.forEach(a => logger.info(`\t${a}`))
                logger.info(`\n`)
 
        })
 
    },
        



    "^arlogs --byrule": async input => {
        //--minguid to show min guid
        //--maxguid to show max guid
        const inputParam = input.match(/--byrule .*/gm)
        let showMaxGuid = false
        let showMinGuid = false
        if (inputParam != null && inputParam.length > 0 && inputParam[0].indexOf("--maxguid") > -1)
            showMaxGuid = true

        if (inputParam != null && inputParam.length > 0 && inputParam[0].indexOf("--minguid") > -1)
            showMinGuid = true

            
        const ageInputParam = input.match(/--age [0-9]*/)
        let mins = 30;  //query logs for the last 30 minutes
        if (ageInputParam != null && ageInputParam.length > 0)
            mins = ageInputParam[0].replace("--age ", "")
        
            
       const startTime = Date.now() - mins*60*1000
       const endTime = Date.now();

        const pageSize = 10000 //maximum messages per page
        logger.info(`Querying attribute rules logs for ${parameters.service} in the past ${mins} minutes...`)
        let result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize, startTime ,endTime , "DEBUG")
        let jsonRes = await result.json()
        let allMessages = [].concat(jsonRes.logMessages)
        
        while (jsonRes.hasMore && jsonRes.endTime > startTime)
        {  
            //start paging
            logger.info(`Aggregating messages... total so far ${allMessages.length} debug entries but more left, pulling logs before ${new Date(jsonRes.endTime)}`)
      
            
            result= await adminLog.query([102003], [parameters.service + ".MapServer"], pageSize, jsonRes.endTime  )
            jsonRes = await result.json()
            allMessages = allMessages.concat(jsonRes.logMessages)
        }  

        const arMessages = allMessages
            .filter(m => m.message.indexOf("Attribute rule execution complete:") > -1)
            .map (m =>  JSON.parse(decodeHTMLEntities(m.message.replace("Attribute rule execution complete:", ""))))
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
                           "avgTime": 0,
                           "maxGuid": null,
                           "minGuid": null
                       };
                     }
                
                     prev [cur["Rule name"]].totalTime = prev [cur["Rule name"]].totalTime + cur["Elapsed Time (ms)"]
                      
                     if (cur["Elapsed Time (ms)"] < prev [cur["Rule name"]].minTime ) {
                        prev [cur["Rule name"]].minTime = cur["Elapsed Time (ms)"];
                        prev [cur["Rule name"]].minGuid = cur["GlobalID"];
                     }

                    if (cur["Elapsed Time (ms)"] > prev [cur["Rule name"]].maxTime ){
                        prev [cur["Rule name"]].maxTime = cur["Elapsed Time (ms)"];
                        prev [cur["Rule name"]].maxGuid = cur["GlobalID"];
                    }
                     
                    prev [cur["Rule name"]].occurrence++
                     
                    prev [cur["Rule name"]].avgTime = prev [cur["Rule name"]].totalTime / prev [cur["Rule name"]].occurrence

                return prev
            }, {})

        const rules = Object.keys(arMessages)
        .map(a => {
                const rule = {}
                rule["Attribute Rule"] = a;
                rule["Total Cost (ms)"] = parseFloat(arMessages[a].totalTime.toFixed(2))
                if (!showMinGuid && !showMaxGuid) rule["Average Cost (ms)"] = parseFloat(arMessages[a].avgTime.toFixed(2))
                rule["Max execution time (ms)"] = parseFloat(arMessages[a].maxTime.toFixed(2))
                if (showMaxGuid) rule["Max GUID"] = arMessages[a].maxGuid
                rule["Min execution time (ms)"] = parseFloat(arMessages[a].minTime.toFixed(2))
                if (showMinGuid) rule["Min GUID"] = arMessages[a].minGuid
                if (!showMinGuid && !showMaxGuid) rule["Occurrence"] = arMessages[a].occurrence;
                return rule;
        })
        .sort( (m1, m2) => m2["Total Cost (ms)"] -m1["Total Cost (ms)"])
        console.table(rules)

        const totalARExecution = rules.reduce( (prev, cur) =>  prev + cur["Total Cost (ms)"], 0)
        logger.info(`Total time spend executing attribute rules (${Math.round(totalARExecution)} ms) (${Math.round(totalARExecution/1000)} s) (${Math.round(totalARExecution/(1000*60))} m)`)
         
    },

    "^version$": () => logger.info(version),
    "^clear$|^cls$": () => console.clear(),
    "^quit$": () => {
        if (rl) rl.close();
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
        logger.info(`Processing ${recordCount} rows`)
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
        logger.info(`${name}, is a citizen of ${country}`);
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
        logger.info("\nbye");
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
    logger.info(`uncli ${version} is experimental command line utility for basic utility network services. Use as is.`)
    parameters = await parseInput( )
    //set certificate verification 
    const verifyCert = parameters["verify"] === 'true' ? 1 : 0;
    const proxy = parameters["proxy"]
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = verifyCert;

    if (proxy){
        logger.info(`Using proxy ${proxy}`);
        process.env['HTTPS_PROXY'] = proxy;
    }

        

    setTimeout( async ()=> await regenerateToken(parameters) , 1000*60*GENERATE_TOKEN_TIME_MIN)
    await connect(parameters)
}


function decodeHTMLEntities (x) {
    const entities = { 
        '&lt;': '<', 
        '&gt;': '>', 
        '&amp;': '&', 
        '&quot;': '"', 
        '&apos;': "'" 
    }; 
     
    const y =  x.replace(/&[a-zA-Z0-9#]+;/g, (match) => entities[match] || match); 
   return y
}



async function reconcileLogs (mins, service) {

  
parameters.service = service
 

console.log(`Querying reconcile logs for ${parameters.service} for the last ${mins} minutes ...`)

    //startTime is the most recent
    //endTime is the oldest

     
 //page query the admin log , search for /applyEdits logs by methodname
  let allMessages = await adminLog.query(mins, parameters.service, [102003,102024,102023], "", "DEBUG")

 
      
    //build out the dictionary, key is request id, value is another dictionary
    const queryLogs = {}
    //sort by time
    allMessages = allMessages.sort ( (m1, m2) => m2.time - m1.time )
    allMessages.forEach (m => {

        if (!queryLogs[m.requestID])
            queryLogs[m.requestID] = {"message": "Time,Method,Elapsed_ms,Message"}

        queryLogs[m.requestID].message += "\r\n" + m.time + "," + m.methodName + "," + Math.round(m.elapsed*1000) + "," + m.message 

        //get elapsed
        //check for async (method GPReconcileVersionAsync::Execute)
        //sync
        //VersionManagementServer::HandleREST_ReconcileOperation
        //message Returned moment: 
        if (m.message.indexOf("Returned moment: ")> -1 && 
        ( m.methodName.indexOf("VersionManagementServer::HandleREST_ReconcileOperation") > -1 ||
         m.methodName.indexOf("GPReconcileVersionAsync::Execute") > -1 
        ) 
        )
        {
            queryLogs[m.requestID].elapsed = m.elapsed
            queryLogs[m.requestID].source = m.source.replace(".MapServer", "")
            queryLogs[m.requestID].user = m.user
            queryLogs[m.requestID].time = m.time
            queryLogs[m.requestID].requestID = m.requestID
            queryLogs[m.requestID].methodName = m.methodName
 
        }
        
        if (m.message.indexOf("EndReconcile;") > -1)
        {
            queryLogs[m.requestID].gdbVersion = m.message.replace("EndReconcile;","")
   
            
        }

        
        
    })

    allMessages = []

     Object.keys(queryLogs).forEach(k =>
        {
            const m = queryLogs[k]
            if (m.methodName)
                allMessages.push(m)
              
        })


    
  console.log ("Filtering messages...") 
 
  allMessages = filterMessages(allMessages)
  .sort( (m1,m2) => Math.round(m2.elapsed*1000) -Math.round(m1.elapsed*1000))
  console.table(allMessages)
 
}



function printFishnet(fishnet) {

    //y is flipped x is ok
    //i = 0 that is i = fishnet.length -1
    for (let i =0; i < fishnet.length ; i++){
        
        for (let j = 0; j < fishnet[i].length;j++) 
            process.stdout.write("+------");

        process.stdout.write("+\n")

        for (let j = 0; j < fishnet[i].length;j++)
            process.stdout.write(`|   ${fishnet[fishnet.length - 1 - i][j].content}  `);
 
        process.stdout.write("|\n")
    }


    for (let j = 0; j < fishnet.length;j++) 
        process.stdout.write("+------");
    
    process.stdout.write("+\n\n")

}

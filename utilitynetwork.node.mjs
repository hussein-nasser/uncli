'use strict';
//Author : Hussein Nasser
//Date   : Jan-23-2018
//Mod    : May-18-2020
//Twitter: @hnasr


/*
import fetch from "node-fetch"
*/
import   logger   from "./logger.mjs" 
import { makeRequest } from "./makerequest.mjs"

  

export class UtilityNetwork {

        constructor(token, featureServiceUrl, gdbVersion="sde.DEFAULT")
        {   

            this.featureServiceUrl = featureServiceUrl;
            this.token = token;         
            this.gdbVersion = gdbVersion;
            this.sourceMapping = {}
        }

      ///first function one should call after creating an instance of a utility network
       load ()
        {
            let thisObj = this;
            
            return new Promise (function (resolve, reject)
            {
                //run async mode
                (async function () {    
                    try {


                 
                //pull the feature service definition'
                logger.info("Fetching the feature service definition...")
                let featureServiceJsonResult = await makeRequest({method: 'POST', timeout: 120000, url: thisObj.featureServiceUrl, params: {f : "json", token: thisObj.token}});
                thisObj.featureServiceJson = featureServiceJsonResult
                //check to see if the feature service has a UN
                if (thisObj.featureServiceJson.controllerDatasetLayers != undefined)
                {   
                    thisObj.layerId = thisObj.featureServiceJson.controllerDatasetLayers.utilityNetworkLayerId;
                    let queryDataElementUrl = thisObj.featureServiceUrl + "/queryDataElements";
                    let layers = "["  + thisObj.layerId + "]"
                
                    let postJson = {
                        token: thisObj.token,
                        layers: layers,
                        f: "json"
                    }
                    logger.info("Fetching the utility network data element ...")
                    //pull the data element definition of the utility network now that we have the utility network layer
                    let undataElement = await makeRequest({method: 'POST', url: queryDataElementUrl, params: postJson });
                    
                    //request the un layer defition which has different set of information
                    let unLayerUrl = thisObj.featureServiceUrl + "/" + thisObj.layerId;
                    postJson = {
                        token: thisObj.token,
                        f: "json"
                    }

                    logger.info("Fetching the utility network layer definition ...")

                    let unLayerDef = await makeRequest({method: 'POST', url: unLayerUrl, params: postJson });
            
                    thisObj.dataElement = undataElement.layerDataElements[0].dataElement;
                    thisObj.layerDefinition = unLayerDef
                    thisObj.subnetLineLayerId = thisObj.getSubnetLineLayerId();     
                    
                    //build out source mapping hash
                    let domainNetworks = thisObj.dataElement.domainNetworks;
                    let layerObj = undefined;

                    for (let i = 0; i < domainNetworks.length; i ++)
                    {
                        let domainNetwork = domainNetworks[i];
                        for (let j = 0; j < domainNetwork.junctionSources.length; j ++)
                            {  
                                layerObj =  {type: domainNetwork.junctionSources[j].shapeType, layerId: domainNetwork.junctionSources[j].layerId}
                                layerObj.type = layerObj.type.replace("esriGeometry", "").toLowerCase();
                                thisObj.sourceMapping["s" + domainNetwork.junctionSources[j].sourceId] = layerObj
                            }

                        for (let j = 0; j < domainNetwork.edgeSources.length; j ++)
                             { 
                                layerObj = {type: domainNetwork.edgeSources[j].shapeType, layerId: domainNetwork.edgeSources[j].layerId} 
                                layerObj.type = layerObj.type.replace("esriGeometry", "").toLowerCase();
                                thisObj.sourceMapping["s" + domainNetwork.edgeSources[j].sourceId] = layerObj
                            }
                    }
  
                    resolve(thisObj);
                }
                else
                    reject("No Utility Network found in this feature service");

            }

            catch(ex){
                reject(ex)
            }
            })();
                })

       
            }

        
        isAssocaitionValid(associationRow) {
            
            return new Promise(

                async (resolve, reject) => {
                    try {
                        //fromnetworksourceid
                        //fromglobalid
                        //logger.info("Checking from side of the association ")
                        const fromDate = new Date();
                        const fromLayer = this.getLayerIdfromSourceId(v(associationRow.attributes,"fromnetworksourceid"))
                        const fromGuidExists = (await this.queryCount(fromLayer.layerId, `globalId = '${v(associationRow.attributes,"fromglobalid")}'`)).count > 0
                        //logger.info("Done " + fromGuidExists)

                        //tonetworksourceid 
                        //toglobalid
                        //logger.info("Checking to side of the association ")
                        const toLayer = this.getLayerIdfromSourceId(v(associationRow.attributes,"tonetworksourceid"))
                        const toGuidExists = (await this.queryCount(toLayer.layerId, `globalId = '${v(associationRow.attributes,"toglobalid")}'`)).count > 0 
                        //logger.info("Done " + toGuidExists)
                        const toDate = new Date();
                       //logger.info(toDate.getTime() - fromDate.getTime());
                        resolve( fromGuidExists && toGuidExists)                        
                    }
                    catch (ex) {
                        reject(ex);
                    }
                 
        
    
                }
                )


        }
            
        /*
            //a function that detects associations with from/to globalId that don't exist in the source tables.
            //if one of the endpoints do not exists fails.. 
        returnInvalidAssociations() {
            return new Promise(

            async (resolve, reject) => {
                try {
                    //query all associations..  page 2000 rows
    
               //for each association row - validate that from/to source actually exists
               //find that layerId fromSourceId, fromGlobalId, query Count and make sure it exists. 
              //find the layerId of toSourceId, toGlobalId , query count make sure it exists 
              //if doesn't exist add to invalid assocaition array. 
                    const invalidAssociations = [];
                    //objectid >= ${offset} and objectid <= ${recordCount+offset}
                     let c = 0;
                    let offset = 0;
                    let recordCount = 2000;
                    while(true) {
                        const result = await this.query(500001, `1=1`, undefined, undefined, ["*"], "sde.DEFAULT", offset, recordCount)
                        console.log(`Processing ${recordCount} associations`)
                        //for each assocaition check if its valid
                        const bar = new ProgressBar(':bar', { total: result.features.length });
                        for (let i = 0 ; i < result.features.length; i++){
                            const associationRow = result.features[i]
                            const isValid = await this.isAssocaitionValid( associationRow);
                            if (!isValid){ 
                                const associationGuid =  v(associationRow.attributes, "globalid");
                                invalidAssociations.push({
                                    "assocaitionGuid":associationGuid
                                })
                              //console.log(`Discoved an invalid assocaition. ${associationGuid}`)
                              //console.log("x")
                            }
                            
                            bar.tick();
                        }
 

                        //keep asking if this is true
                        if (!result.exceededTransferLimit) break;
                        offset+= recordCount;
                    }
 
                    resolve(invalidAssociations); 
                }catch (ex) {
                    reject(ex);
                }
             
    

            }
            )
           

        }   
        */
        queryMoment(moment = ["definitionModification"]) {
              
            let thisObj = this; 
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="UtilityNetworkServer";
            let url = ar.join("/") + "/queryNetworkMoments"
            const momentsToReturn = JSON.stringify(moment)
            let postJson = {    
                token: this.token,
                gdbVersion:this.gdbVersion,
                momentsToReturn: momentsToReturn,
                f: "json"
            }
          
 
        //const controller = new AbortController();
        //const signal = controller.signal;
        //setTimeout(() => controller.abort(), timeout);

        return makeRequest({method: 'POST', url: url, params: postJson});
        //return fetch( unUrl, {signal: signal, method: 'POST', body : body,   headers: {'Content-Type': 'application/x-www-form-urlencoded'} }).then(res => res.json());

       }
     
    
        //return the domainNetwork object.     
        getDomainNetwork(domainNetworkName)
        {
          
            for (let domainNetwork of this.dataElement.domainNetworks)
               if (domainNetwork.domainNetworkName === domainNetworkName) return domainNetwork;
            
            return undefined;
        }
        //return the tier
        getTier(domainNetworkName, tierName)
        {   
            const domainNetwork = this.getDomainNetwork(domainNetworkName);
            if (domainNetwork === undefined) return;
            
            for (let tier of domainNetwork.tiers)
              if (tier.name === tierName) 
               return tier;
        }
        //query the subnetwokrs table 
        getSubnetworks(domainNetworkName, tierName)
        {
            let subnetworkTableUrl = this.featureServiceUrl + "/" + this.layerDefinition.systemLayers.subnetworksTableId + "/query";
            
            let postJson = {
                token: this.token,
                where: "DOMAINNETWORKNAME = '" + domainNetworkName + "' AND TIERNAME = '" + tierName + "'",
                outFields: "SUBNETWORKNAME",
                orderByFields: "SUBNETWORKNAME",
                gdbVersion:this.gdbVersion,

                returnDistinctValues: true,
                f: "json"
            }

            return makeRequest({method: 'POST', url: subnetworkTableUrl, params: postJson});

        }

        getSubnetworks(whereclause = "1=1") {

            let subnetworkTableUrl = this.featureServiceUrl + "/" + this.layerDefinition.systemLayers.subnetworksTableId + "/query";
            
            let postJson = {
                token: this.token,
                where: whereclause,
                outFields: "DOMAINNETWORKNAME, TIERNAME, SUBNETWORKNAME",
                orderByFields: "DOMAINNETWORKNAME, TIERNAME, SUBNETWORKNAME",
                gdbVersion:this.gdbVersion,
                returnDistinctValues: true,
                f: "json"
            }
            
            return makeRequest({method: 'POST', url: subnetworkTableUrl, params: postJson});
        }
        queryCount(layerId, where ="1=1") {

            let queryJson = {
                f: "json",
                token: this.token,
                returnCountOnly: true,            
                where: where,
                gdbVersion:this.gdbVersion,
            }
 
            queryJson.layerId = layerId 

           return makeRequest({method: 'POST', params: queryJson, url: this.featureServiceUrl + "/" + layerId + "/query"})
             
        }
        
        queryDistinct(layerId, field, where, orderby) {
           
            let queryJson = {
                f: "json",
                token: this.token,
                outFields: field,
                where: where,
                gdbVersion:this.gdbVersion,
                returnDistinctValues: true,
                orderByFields: orderby,

            }
 
            queryJson.layerId = layerId
            return new Promise((resolve, reject) => {

                makeRequest({method: 'POST', params: queryJson, url: this.featureServiceUrl + "/" + layerId + "/query"}).then(rowsJson=> {                  
                    resolve(rowsJson);
                }).catch(rej => reject("failed to query"));
                
            });
                


        }
        //query that projects to webmercator. 
        query(layerId, where, obj, objectids, outFields = "*", resultOffset = 0, resultRecordCount=2000)
        {   
            let webMercSpatialReference = {
                "wkid": 102100,
                "latestWkid": 3857,
                "xyTolerance": 0.001,
                "zTolerance": 0.001,
                "mTolerance": 0.001,
                "falseX": -20037700,
                "falseY": -30241100,
                "xyUnits": 148923141.92838538,
                "falseZ": -100000,
                "zUnits": 10000,
                "falseM": -100000,
                "mUnits": 10000
                }

            let queryJson = {
                f: "json",
                token: this.token,
                outFields: outFields,
                where: where,
                gdbVersion:this.gdbVersion,
                outSR: JSON.stringify(webMercSpatialReference),
                resultOffset: resultOffset,
                resultRecordCount: resultRecordCount
            }

            if (objectids != undefined) 
            queryJson.objectIds = objectids;
            queryJson.layerId = layerId
            return new Promise(async(resolve, reject) => {


                
                let rowsJson;
                let allRowsJson;
                let recordOffset = 0;

                try {

                    do {
                        queryJson.resultOffset = recordOffset;
                        rowsJson  = await makeRequest({method: 'POST', params: queryJson, url: this.featureServiceUrl + "/" + layerId + "/query"}) ;                
                        recordOffset = recordOffset + resultRecordCount + 1;
                        rowsJson.obj = obj;

                        if (!allRowsJson)
                          allRowsJson = rowsJson
                        else
                          allRowsJson?.features.push(...rowsJson?.features)
                        //page the result until done
                    }
                    while(rowsJson?.exceededTransferLimit == true)

                    resolve(allRowsJson);
                }
                catch(ex){
                    reject("failed to query" + JSON.stringify(ex))
                }

                
           

            });
                

            
       // }
       // while(jsonRes?.exceededTransferLimit == true)
      // if (!allJsonRes)
     //  allJsonRes = jsonRes
 // else
      // allJsonRes?.features.push(...jsonRes?.features)
        }
        //get the terminal configuration using the id
        getTerminalConfiguration(terminalConfigurationId)
        {
            return this.dataElement.terminalConfigurations.find(tc => tc.terminalConfigurationId === terminalConfigurationId);
        }
        
        getSystemLayers() {
            const systemLayers = []; 

                
            systemLayers.push({
                "id": 500001,
                "name": "Association",
                "type": "Feature Layer",
                "geometryType": "None" 
            })

            systemLayers.push({
                "id": 500002,
                "name": "Subnetworks",
                "type": "Feature Layer",
                "geometryType": "None" 
            })

            systemLayers.push({
                "id": 500003,
                "name": "Rules",
                "type": "Feature Layer",
                "geometryType": "None" 
            })


            systemLayers.push({
                "id": this.layerDefinition.systemLayers.dirtyAreasLayerId,
                "name": "Dirty Areas",
                "type": "Feature Layer",
                "geometryType": "Polygon" 
            })

            

            if (this.layerDefinition.systemLayers.dirtyObjectsTableId)
                systemLayers.push({
                    "id": this.layerDefinition.systemLayers.dirtyObjectsTableId,
                    "name": "Dirty Objects",
                    "type": "Feature Layer",
                    "geometryType": "None" 
                })

            if (this.layerDefinition.systemLayers.pointErrorsLayerId)
            systemLayers.push({
                "id": this.layerDefinition.systemLayers.pointErrorsLayerId,
                "name": "Point Errors",
                "type": "Feature Layer",
                "geometryType": "Point" 
            })

            if (this.layerDefinition.systemLayers.lineErrorsLayerId)
            systemLayers.push({
                "id": this.layerDefinition.systemLayers.lineErrorsLayerId,
                "name": "Line Errors",
                "type": "Feature Layer",
                "geometryType": "Line" 
            })
            
            if (this.layerDefinition.systemLayers.polygonErrorsLayerId)
            systemLayers.push({
                "id": this.layerDefinition.systemLayers.polygonErrorsLayerId,
                "name": "Polygon Errors",
                "type": "Feature Layer",
                "geometryType": "Polygon" 
            })

            return systemLayers;
        
        }
        //get the subenetline layer
        getSubnetLineLayerId()
        {

            //esriUNFCUTSubnetLine

            let domainNetworks = this.dataElement.domainNetworks;
            
            for (let i = 0; i < domainNetworks.length; i ++)
            {
                let domainNetwork = domainNetworks[i];
                //only search edgeSources since subnetline is a line
                for (let j = 0; j < domainNetwork.edgeSources.length; j ++)
                    if (domainNetwork.edgeSources[j].utilityNetworkFeatureClassUsageType === "esriUNFCUTSubnetLine")
                        return domainNetwork.edgeSources[j].layerId;
            }

        }

        //return the asset type 
        getAssetType(layerId, assetGroupCode, assetTypeCode)
        {

            let domainNetworks = this.dataElement.domainNetworks;
            let layerObj = undefined;

            for (let i = 0; i < domainNetworks.length; i ++)
            {
                let domainNetwork = domainNetworks[i];
                for (let j = 0; j < domainNetwork.junctionSources.length; j ++)
                    if (domainNetwork.junctionSources[j].layerId == layerId)
                    {  
                           let assetGroup = domainNetwork.junctionSources[j].assetGroups.find( ag => ag.assetGroupCode === assetGroupCode);
                           if (assetGroup instanceof Object)
                           {
                             let assetType = assetGroup.assetTypes.find(at => at.assetTypeCode === assetTypeCode);
                             assetType.assetGroupName = assetGroup.assetGroupName;
                             assetType.utilityNetworkFeatureClassUsageType = domainNetwork.junctionSources[j].utilityNetworkFeatureClassUsageType;
                             if(assetType instanceof Object) return assetType;
                           }                          
                    }

                for (let j = 0; j < domainNetwork.edgeSources.length; j ++)
                    if (domainNetwork.edgeSources[j].layerId == layerId)
                    { 
                        let assetGroup = domainNetwork.edgeSources[j].assetGroups.find( ag => ag.assetGroupCode === assetGroupCode);
                        if (assetGroup instanceof Object)
                        {
                          let assetType = assetGroup.assetTypes.find(at => at.assetTypeCode === assetTypeCode);
                          assetType.assetGroupName = assetGroup.assetGroupName;
                          assetType.utilityNetworkFeatureClassUsageType = domainNetwork.edgeSources[j].utilityNetworkFeatureClassUsageType;
                          if(assetType instanceof Object) return assetType;
                        }            
                    }
            }
 
            return undefined; 
        }

        getLayerbyName (name) {
            return this.featureServiceJson.layers.find(l => l.name.toLowerCase().replace(" ","") === name.toLowerCase().replace(" ",""));
        }

        //return layer by type
        getLayer(utilityNetworkUsageType) {

            let domainNetworks = this.dataElement.domainNetworks;
            let layers = []
            for (let i = 0; i < domainNetworks.length; i ++)
            {
                let domainNetwork = domainNetworks[i];
              
                for (let j = 0; j < domainNetwork.junctionSources.length; j ++)
                    if (domainNetwork.junctionSources[j].utilityNetworkFeatureClassUsageType === utilityNetworkUsageType)
                        layers.push(domainNetwork.junctionSources[j].layerId);
            }

            for (let i = 0; i < domainNetworks.length; i ++)
            {
                let domainNetwork = domainNetworks[i];
              
                for (let j = 0; j < domainNetwork.edgeSources.length; j ++)
                    if (domainNetwork.edgeSources[j].utilityNetworkFeatureClassUsageType === utilityNetworkUsageType)
                        layers.push(domainNetwork.edgeSources[j].layerId)
            }

            return layers;
        }
        //return the first device layer
        getDeviceLayers() {
            
          return this.getLayer("esriUNFCUTDevice");

        }
        //return the first junction layer
        getJunctionLayers() {

            return this.getLayer("esriUNFCUTJunction");
        }
        //return the first Line layer
        getLineLayers() {
            return this.getLayer("esriUNFCUTLine");
        }

        //determines if the layerid is a line or point... 
        isLayerEdge(layerId) {

            let domainNetworks = this.dataElement.domainNetworks;

            for (let i = 0; i < domainNetworks.length; i ++)
            {
                let domainNetwork = domainNetworks[i];
              
                for (let j = 0; j < domainNetwork.edgeSources.length; j ++)
                    if (domainNetwork.edgeSources[j].layerId === layerId)
                        return true;
            }

            return false;
        }


        //get layer id from Source Id used to map sourceid to layer id
        getLayerIdfromSourceId(sourceId)
        { 
 
            return this.sourceMapping["s" + sourceId]
            /*
            let domainNetworks = this.dataElement.domainNetworks;

            for (let i = 0; i < domainNetworks.length; i ++)
            {
                let domainNetwork = domainNetworks[i];
                for (let j = 0; j < domainNetwork.junctionSources.length; j ++)
                    if (domainNetwork.junctionSources[j].sourceId == sourceId)
                    {  
                          layerObj =  {type: domainNetwork.junctionSources[j].shapeType, layerId: domainNetwork.junctionSources[j].layerId}
                          break;
                    }

                for (let j = 0; j < domainNetwork.edgeSources.length; j ++)
                    if (domainNetwork.edgeSources[j].sourceId == sourceId)
                    { 
                         layerObj = {type: domainNetwork.edgeSources[j].shapeType, layerId: domainNetwork.edgeSources[j].layerId} 
                         break;
                    }
            }

            if (layerObj != undefined)
                layerObj.type = layerObj.type.replace("esriGeometry", "").toLowerCase();
            */

            return layerObj;
        }

        //receives an array of starting locations and transforms it for the rest params.. 
        //an array of [{"traceLocationType":"startingPoint", assetGroupCode: 5, assetTypeCode:5, layerId: 5, "globalId":"{00B313AC-FBC4-4FF4-9D7A-6BF40F4D4CAD}"}]
        buildTraceLocations (traceLocationsParam) {

            let traceLocations = [];
            //terminalId  percentAlong: 0
            //line starting point [{"traceLocationType":"startingPoint","globalId":"{00B313AC-FBC4-4FF4-9D7A-6BF40F4D4CAD}","percentAlong":0.84695770913918678}]
            traceLocationsParam.forEach(s=> {
                //if layerid doesn't exists get it from the sourceid..
                if (s.layerId === undefined) s.layerId = this.getLayerIdfromSourceId(s.networkSourceId);

                if (this.isLayerEdge(s.layerId) === true)
                    traceLocations.push({traceLocationType: s.traceLocationType, globalId:s.globalId , percentAlong: 0.5 } ) //add the starting point to themiddle of the line temporary
                else {
                    //if its a junction, check if a terminalid is passed if not then get the terminal configuration and add all possible terminals temrporary..
                    if (s.terminalId === undefined && s.terminalId != -1) {
                        let at = this.getAssetType(s.layerId, s.assetGroupCode, s.assetTypeCode);
                        let tc = this.getTerminalConfiguration(at.terminalConfigurationId)
                        tc.terminals.forEach(t => traceLocations.push({traceLocationType: s.traceLocationType, globalId:s.globalId , terminalId: t.terminalId } ))                    
                        }
                    else
                    {
                        traceLocations.push({traceLocationType: s.traceLocationType, globalId:s.globalId , terminalId: s.terminalId } )                   
                    }
                }
                   
            }
            );

            return traceLocations;
        }
        
        //if it is an error we return true assuming we couldn't trace if no elements exists for this feature.. or any other..
        isInIsland (traceLocationsParam) {
            return new Promise( (resolve, reject) => {

                //this trace configuration stops when it finds a single controller.
                let traceConfiguration = {"includeContainers":false,"includeContent":false,"includeStructures":false,"includeBarriers":true,"validateConsistency":false,"domainNetworkName":"","tierName":"","targetTierName":"","subnetworkName":"","diagramTemplateName":"","shortestPathNetworkAttributeName":"","filterBitsetNetworkAttributeName":"","traversabilityScope":"junctions","conditionBarriers":[{"name":"Is subnetwork controller","type":"networkAttribute","operator":"equal","value":1,"combineUsingOr":false,"isSpecificValue":true}],"functionBarriers":[{"functionType":"add","networkAttributeName":"Is subnetwork controller","operator":"equal","value":1,"useLocalValues":false}],"arcadeExpressionBarrier":"","filterBarriers":[{"name":"Is subnetwork controller","type":"networkAttribute","operator":"equal","value":1,"combineUsingOr":false,"isSpecificValue":true}],"filterFunctionBarriers":[],"filterScope":"junctions","functions":[],"nearestNeighbor":{"count":-1,"costNetworkAttributeName":"","nearestCategories":[],"nearestAssets":[]},"outputFilters":[],"outputConditions":[{"name":"Is subnetwork controller","type":"networkAttribute","operator":"equal","value":1,"combineUsingOr":false,"isSpecificValue":true},{"name":"Category","type":"category","operator":"equal","value":"Subnetwork Controller","combineUsingOr":false,"isSpecificValue":true}],"propagators":[]}
                this.Trace(traceLocationsParam, "connected", traceConfiguration)
                .then (results => {
                    if (results.traceResults.success === false) 
                    {
                        console.log ("Error tracing " + JSON.stringify(traceLocationsParam));
                        reject(true);
                    }
                    else
                        resolve(results.traceResults.elements.length === 0)
                })
                .catch (er => {
                    console.log ("Error tracing " + JSON.stringify(traceLocationsParam));
                    reject(true);});

            })
           
        }

        //run connected Trace
        connectedTrace(traceLocationsParam, traceConfiguration)
        {                      
            return this.Trace(traceLocationsParam, "connected", traceConfiguration);
        }

        //generic trace function
        Trace (traceLocationsParam, traceType, traceConfiguration, forceFail=true) {
            
            let traceLocations = this.buildTraceLocations (traceLocationsParam);
            return new Promise((resolve, reject) => {
                if (traceConfiguration === undefined) 
                    traceConfiguration = emptyTraceConfiguration; //{"includeContainers":false,"includeContent":false,"includeStructures":false,"includeBarriers":true,"validateConsistency":false,"domainNetworkName":"","tierName":"","targetTierName":"","subnetworkName":"","diagramTemplateName":"","shortestPathNetworkAttributeName":"","filterBitsetNetworkAttributeName":"","traversabilityScope":"junctionsAndEdges","conditionBarriers":[],"functionBarriers":[],"arcadeExpressionBarrier":"","filterBarriers":[],"filterFunctionBarriers":[],"filterScope":"junctionsAndEdges","functions":[],"nearestNeighbor":{"count":-1,"costNetworkAttributeName":"","nearestCategories":[],"nearestAssets":[]},"outputFilters":[],"outputConditions":[],"propagators":[]}
 
                //serviceJson load each layer.. 
               let ar = this.featureServiceUrl.split("/");
               ar[ar.length-1]="UtilityNetworkServer";
               let traceUrl = ar.join("/") + "/trace"
                 let traceJson = {
                    f: "json",
                    token: this.token,
                    traceType : traceType,
                    gdbVersion:this.gdbVersion,
                    traceLocations: JSON.stringify(traceLocations),
                    traceConfiguration: JSON.stringify(traceConfiguration)
                }
                let un = this;
                makeRequest({method:'POST', params: traceJson, url: traceUrl })
                .then(featuresJson=> featuresJson.success === false && forceFail === true ? reject(JSON.stringify(featuresJson)) : resolve( featuresJson))
                .catch(e=> reject("failed to execute trace. " + e));
 
            });
        }



        subnetworkControllerTrace (traceLocationsParam, domainNetworkName, tierName, subnetworkName, traceConfiguration)  {
 
            
            if (traceConfiguration === undefined)
            {  
  
             let tier = this.getTier(domainNetworkName, tierName);
             let subnetworkDef = tier.updateSubnetworkTraceConfiguration;
             subnetworkDef.functions = [] //we don't want the big payload of functions
             subnetworkDef.subnetworkName = subnetworkName;
             //disable consistency
             subnetworkDef.validateConsistency = true;
             traceConfiguration = subnetworkDef;
             //if no trace configuration passed to override use the tier subnetwork definition
           }

            return this.Trace(traceLocationsParam, "subnetworkController", traceConfiguration,false);
            
        }

        upstreamTrace (traceLocationsParam, domainNetworkName, tierName, subnetworkName, traceConfiguration, targetTier) {

            
            if (traceConfiguration === undefined)
            {  
  
             let tier = this.getTier(domainNetworkName, tierName);
             let subnetworkDef = tier.updateSubnetworkTraceConfiguration;
             subnetworkDef.subnetworkName = subnetworkName;
             //disable consistency
             subnetworkDef.validateConsistency = false;
             traceConfiguration = subnetworkDef;
             traceConfiguration.targetTierName = targetTier;
             //{"includeContainers":true,"includeContent":false,"includeStructures":true,"includeBarriers":false,"validateConsistency":true,"domainNetworkName":"ElectricDistribution","tierName":"Low Voltage","targetTierName":"Medium Voltage","subnetworkName":"","diagramTemplateName":"","shortestPathNetworkAttributeName":"","filterBitsetNetworkAttributeName":"","traversabilityScope":"junctionsAndEdges","conditionBarriers":[{"name":"Device Status","type":"networkAttribute","operator":"equal","value":1,"combineUsingOr":false,"isSpecificValue":true}],"functionBarriers":[],"arcadeExpressionBarrier":"","filterBarriers":[],"filterFunctionBarriers":[],"filterScope":"junctionsAndEdges","functions":[],"nearestNeighbor":{"count":-1,"costNetworkAttributeName":"","nearestCategories":[],"nearestAssets":[]},"outputFilters":[],"outputConditions":[],"propagators":[]}
             //if no trace configuration passed to override use the tier subnetwork definition
           }
              

            return this.Trace(traceLocationsParam, "upstream", traceConfiguration);
        }


        downstreamTrace (traceLocationsParam, domainNetworkName, tierName, subnetworkName, traceConfiguration, targetTier) {

            
            
            if (traceConfiguration === undefined)
            {  
  
             let tier = this.getTier(domainNetworkName, tierName);
             let subnetworkDef = tier.updateSubnetworkTraceConfiguration;
             subnetworkDef.subnetworkName = subnetworkName;
             //disable consistency
             subnetworkDef.validateConsistency = false;
     
             traceConfiguration = subnetworkDef;
             traceConfiguration.targetTierName = targetTier;
             //if no trace configuration passed to override use the tier subnetwork definition
           }

                       
            return this.Trace(traceLocationsParam, "downstream", traceConfiguration);
        }

        //traces a single subnetwork
        async subnetworkTraceSimple(subnetworkName) {
            //query to find the tier and domain network
            const result = await this.query(500002, `subnetworkname = '${subnetworkName}'`, "", "", "TIERNAME,DOMAINNETWORKNAME")
            if (result.features.length == 0) return null; 
            const subnetworkRow = result.features[0];
            const domainNetworkName = v(subnetworkRow.attributes, "DOMAINNETWORKNAME");
            const tierName = v(subnetworkRow.attributes, "TIERNAME");
  
            return this.subnetworkTrace([], domainNetworkName, tierName, subnetworkName )
        }
        //run subnetwork Trace
        subnetworkTrace(traceLocationsParam, domainNetworkName, tierName, subnetworkName, traceConfiguration, forceFail)
        {   

            if (traceConfiguration === undefined)
            {  
  
             let tier = this.getTier(domainNetworkName, tierName);
             let subnetworkDef = tier.updateSubnetworkTraceConfiguration;
             subnetworkDef.subnetworkName = subnetworkName;
             subnetworkDef.functions = []; //we don't want to send the big functions pay load since it is related to summaries.

             //disable consistency
             subnetworkDef.validateConsistency = true;
             traceConfiguration = subnetworkDef;
             //if no trace configuration passed to override use the tier subnetwork definition
           }
           //console.log(traceConfiguration)
            return this.Trace(traceLocationsParam, "subnetwork", traceConfiguration, forceFail);
             
        }

        startReading(versionGuid, sessionGuid){
            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let url = ar.join("/") + "/versions/" + versionGuid.replace("{","").replace("}", "") + "/startReading"
              let vmsJson = {
                 f: "json",
                 sessionId: sessionGuid,
                 token: this.token
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: url })
            
        }


        
        stopReading(versionGuid, sessionGuid){
            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let url = ar.join("/") + "/versions/" + versionGuid.replace("{","").replace("}", "") + "/stopReading"
              let vmsJson = {
                 f: "json",
                 sessionId: sessionGuid,
                 token: this.token
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: url })
            
        }


        
        startEditing(versionGuid, sessionGuid){
            
            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let url = ar.join("/") + "/versions/" + versionGuid.replace("{","").replace("}", "") + "/startEditing"
              let vmsJson = {
                 f: "json",
                 sessionId: sessionGuid,
                 token: this.token
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: url })
            
        }


        
        stopEditing(versionGuid, sessionGuid,saveEdits=true){
            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let url = ar.join("/") + "/versions/" + versionGuid.replace("{","").replace("}", "") + "/stopEditing"
              let vmsJson = {
                 f: "json",
                 sessionId: sessionGuid,
                 saveEdits:saveEdits,
                 token: this.token
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: url })
            
        }

        

        async reconcile (versionGuid, withPost = false, abortIfConflicts=false, conflictDetection=true, async = false ) {

            //startReading use the version guid as a session id
            await this.startReading(versionGuid,versionGuid );
            await this.startEditing(versionGuid,versionGuid );
            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let url = ar.join("/") + "/versions/" + versionGuid.replace("{","").replace("}", "") + "/reconcile"
              let vmsJson = {
                 f: "json",
                 sessionId: versionGuid,
                 withPost: withPost, 
                 async: async,
                 token: this.token
             } 
            
           const result = makeRequest({method:'POST', params: vmsJson, url: url })
            
        /*  if (async == false){
           await this.stopEditing(versionGuid,versionGuid );
           await this.stopReading(versionGuid,versionGuid );}*/

           return result;

        }

         versions() {

            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let createUrl = ar.join("/") + "/versionInfos"
              let vmsJson = {
                 f: "json",
                 token: this.token
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: createUrl })

        }


        
        deleteVersion(gdbVersion) {

            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let createUrl = ar.join("/") + "/delete"
              let vmsJson = {
                 f: "json",
                 token: this.token,
                 versionName: gdbVersion
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: createUrl })

        }

        createVersion(gdbVersion, accessPermission = "public") {

            let thisObj = this;    
            let ar = thisObj.featureServiceUrl.split("/");
            ar[ar.length-1]="VersionManagementServer";

            let createUrl = ar.join("/") + "/create"
              let vmsJson = {
                 f: "json",
                 token: this.token,
                 accessPermission: accessPermission,
                 versionName: gdbVersion
             } 
           
           return makeRequest({method:'POST', params: vmsJson, url: createUrl })

        }

        applyEdits(layerId, adds, updates, deletes, returnServiceEdits=false) {

            // "updates": [{ 
            //    "attributes": {"GLOBALID": deviceGlobalId,"DEVICESTATUS":0},
            //    "geometry":{"x":-113.09526642799995,"y":37.907981071000052,"z":0,"m":null}
            //}]}
             
            //"adds": [{"attributes":{"objectid":18,"assetgroup":1,"assettype":1,"associationstatus":0,"issubnetworkcontroller":0,"isconnected":2,"subnetworkcontrollername":"Unknown","tiername":0,"tierrank":0,"terminalconfiguration":"Default","creationdate":null,"creator":null,"lastupdate":null,"updatedby":null,"globalid":"{814890CC-F66C-45B7-B965-207BE46BC2DA}","labeltext":null,"devicestatus":2,"phasesbuilt":7,"phasesnormal":7,"phasescurrent":7,"assetid":null,"facilityid":null,"subnetworkname":"Unknown","validationstatus":6},
            //"geometry":{"x":-113.09526642799995,"y":37.907981071000052,"z":0,"m":null}}]
            
             //"deletes":["{814890CC-F66C-45B7-B965-207BE46BC2DA}"]
           

            let c = [
                    {
                        "id":layerId
                    }                    
                ]
 
            if (updates != undefined)
                c[0].updates = updates;

            if (adds != undefined)
                c[0].adds = adds;

            if (deletes != undefined)
                c[0].deletes = deletes;


            let params = {
                f: "json",
                token: this.token,
                useGlobalIds: true,
                returnEditMoment: false,
                gdbVersion:this.gdbVersion,
                edits: JSON.stringify(c)
            }
            
            if (returnServiceEdits) params.returnServiceEditsOption =  "originalAndCurrentFeatures"

            let url = this.featureServiceUrl;

            return makeRequest({method: 'post', url: url + '/applyEdits', params: params })

        }


        markControllerDirty(deviceLayerId, deviceGlobalId, devicestatus = 0) {

            let c = [
                    {"id":deviceLayerId,
                    "updates":[{"attributes":{"GLOBALID": deviceGlobalId,"DEVICESTATUS":devicestatus}}]}
                ]

            let params = {
                f: "json",
                token: this.token, 
                useGlobalIds: true,
                returnEditMoment: false,
                gdbVersion:this.gdbVersion,

                edits: JSON.stringify(c)
            }
            
            let url = this.featureServiceUrl;

            return makeRequest({method: 'post', url: url + '/applyEdits', params: params })

        }

        evaluate (extent, selectionSet, evaluationTypes, async = false)  {

            console.log("Evaluating... ")
            /*
                        
            [
            {
                "id": 1,
                "globalIds": [
                "{4C4EB90D-97C1-4AE1-95FC-BF3B0D6ECD7B}"
                ]
            }
            ]



            */
            const extentJson = extent  == null ? "": JSON.stringify(extent);
            const selectionJson = selectionSet == null ? "":  JSON.stringify(selectionSet);
             let thisObj = this;    
             let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="ValidationServer";

             let evaluateUrl = ar.join("/") + "/evaluate"
               let evaluateJson = {
                  f: "json",
                  token: this.token,
                  changesInVersion: false, 
                  evaluationType: JSON.stringify(evaluationTypes),
                  selection: selectionJson,     
                  evaluationArea: extentJson,     
                  gdbVersion:this.gdbVersion,
                  async: async
              } 
            
            return makeRequest({method:'POST', params: evaluateJson, url: evaluateUrl })
        
            

        }

        
        enableTopology(maxErrorCount=10000) {

            let thisObj = this;  

             let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="UtilityNetworkServer";
             let url = ar.join("/") + "/enableTopology" 
               let jsonPayload = {
                  f: "json",
                  token: this.token,
                  maxErrorCount: maxErrorCount
              } 
            
            return makeRequest({method:'POST', params: jsonPayload, url: url })
          
        }

        disableTopology() {

            let thisObj = this;   

             let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="UtilityNetworkServer";
             let url = ar.join("/") + "/disableTopology" 
               let jsonPayload = {
                  f: "json",
                  token: this.token,
                  gdbVersion:this.gdbVersion,
                } 
            
            return makeRequest({method:'POST', params: jsonPayload, url: url })
         

        }
 

 

        updateIsConnected(async=false) {

            let thisObj = this;  
            let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="UtilityNetworkServer";
             let updateisconnectedURL = ar.join("/") + "/updateIsConnected"
     
               let payload = {
                  f: "json",  
                  token: this.token,  
                  async: async
                }
              let un = this;
            
            return makeRequest({method:'POST', params: payload, url: updateisconnectedURL })
        
 

        }


        updateSubnetworks(domainNetworkName, tierName, subnetworkName, async=false) {

            let thisObj = this; 
            let tier = this.getTier(domainNetworkName, tierName);
            let subnetworkDef = {};
            
            if (tier !== undefined) subnetworkDef = tier.updateSubnetworkTraceConfiguration;

             let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="UtilityNetworkServer";
             let updatesubnetworkUrl = ar.join("/") + "/updateSubnetwork"
             //traceConfiguration: JSON.stringify(subnetworkDef),   
               let updatesubnetworkJson = {
                  f: "json",
                  token: this.token,
                  domainNetworkName: domainNetworkName, 
                  tierName: tierName,
                  subnetworkName: subnetworkName,
                  allSubnetworksInTier: false,
                  continueOnFailure: false,               
                  async: async,
                  gdbVersion:this.gdbVersion,
                }
              let un = this;
            
            return makeRequest({method:'POST', params: updatesubnetworkJson, url: updatesubnetworkUrl })
        
 

        }


        exportSubnetworks(domainNetworkName, tierName, subnetworkName, async=false) {

            let thisObj = this; 
            let tier = this.getTier(domainNetworkName, tierName);
            let subnetworkDef = {}
            if (tier !== undefined) subnetworkDef = tier.updateSubnetworkTraceConfiguration;

             let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="UtilityNetworkServer";
             let exportsubnetworkUrl = ar.join("/") + "/exportSubnetwork"
             const resultTypes = [
                {
                  "type": "features",
                  "includeGeometry": true,
                  "includePropagatedValues": false,
                  "includeDomainDescriptions": true,
                  "networkAttributeNames": [
                    "Is subnetwork controller"
                  ],
                  "diagramTemplateName": "",
                  "resultTypeFields": []
                },
                {
                  "type": "connectivity",
                  "includeGeometry": true,
                  "includePropagatedValues": false,
                  "includeDomainDescriptions": true,
                  "networkAttributeNames": [],
                  "diagramTemplateName": "",
                  "resultTypeFields": []
                },
                {
                  "type": "associations",
                  "includeGeometry": false,
                  "includePropagatedValues": false,
                  "includeDomainDescriptions": true,
                  "networkAttributeNames": [],
                  "diagramTemplateName": "",
                  "resultTypeFields": []
                }
              ]
             //traceConfiguration: JSON.stringify(subnetworkDef),   
               let exportsubnetworkJson = {
                  f: "json",
                  token: this.token,
                  domainNetworkName: domainNetworkName, 
                  tierName: tierName,
                  subnetworkName: subnetworkName,
                  exportAcknowledgement: true,
                  allSubnetworksInTier: false,
                  continueOnFailure: false,  
                  async: async,
                  gdbVersion:this.gdbVersion,
                  resultTypes: JSON.stringify(resultTypes)
                }
              let un = this;
            
            return makeRequest({method:'POST', params: exportsubnetworkJson, url: exportsubnetworkUrl })
        
 

        }

        validateNetworkTopology (extentArea = null) {

            const t = {"includeContainers":false,"includeContent":false,"includeStructures":true,"includeBarriers":true,"validateConsistency":true,"includeIsolated":false,"ignoreBarriersAtStartingPoints":false,"domainNetworkName":"","tierName":"","targetTierName":"","subnetworkName":"","diagramTemplateName":"","shortestPathNetworkAttributeName":"","filterBitsetNetworkAttributeName":"","traversabilityScope":"junctionsAndEdges","conditionBarriers":[{"name":"Operational Device Status","type":"networkAttribute","operator":"equal","value":1,"combineUsingOr":false,"isSpecificValue":true}],"functionBarriers":[],"arcadeExpressionBarrier":"","filterBarriers":[],"filterFunctionBarriers":[],"filterScope":"junctionsAndEdges","functions":[],"nearestNeighbor":{"count":-1,"costNetworkAttributeName":"","nearestCategories":[],"nearestAssets":[]},"outputFilters":[],"outputConditions":[],"propagators":[]}
            
            let thisObj = this;
             
            //full extent
             let extent = extentArea;
             if (extentArea === null)
                 extent = thisObj.featureServiceJson.fullExtent;
             
             let ar = thisObj.featureServiceUrl.split("/");
             ar[ar.length-1]="UtilityNetworkServer";
             const validateUrl = ar.join("/") + "/validateNetworkTopology"
            
             const validateJson = {
                  f: "json",
                  token: this.token,
                  validateArea: JSON.stringify(extent), 
                  async: false,
                  gdbVersion:this.gdbVersion,
                }
           
             return  makeRequest({method:'POST', params: validateJson, url: validateUrl })
          
        }


    }

 


    /*
     //Makes a request
     function makeRequest (opts) {
        
        return new Promise(  function (resolve, reject) {

            if (opts.timeout) {
                //client timeout after 60 seconds
                setTimeout( () => reject({"error": `Client timeout, server didn't responde in ${opts.timeout}`}) ,opts.timeout );
            }
            
            const headers = { "Content-type":  "application/x-www-form-urlencoded"}
            let params = opts.params;
            // We'll need to stringify if we've been given an object
            // If we have a string, this is skipped.
            if (params && typeof params === 'object') 
                params = Object.keys(params).map(key =>  encodeURIComponent(key) + '=' + encodeURIComponent(params[key])).join('&');
        
                
            if (opts.headers) 
                Object.keys(opts.headers).forEach(  key => headers[key] = opts.headers[key] )
            
           // console.log(params)
            import("node-fetch")
            .then( fetch => {
                
                fetch.default(opts.url, {
                    "method" : opts.method,
                     "headers":  headers,
                     "body": params
                })
                .then(res => res.json())
                .then(jsonRes => {
                    if (typeof jsonRes !== "object") jsonRes = JSON.parse(jsonRes);
                    resolve(jsonRes);
                })
                .catch(e => 
                    reject({
                        status: e,
                        statusText: "error"
                        })
                 )

            })
               
            
 
  });
}
*/


const v = (o, f, vIfNotFound=null) => {
    for (let p in o) 
        if (p.toLowerCase() === f.toLowerCase())
            return o[p];
    return vIfNotFound;
}
/*
module.exports = {
    "Test" : Test,
    "UtilityNetwork" : UtilityNetwork,
    "buildTest": buildTest,
    "getResult": getResult,
    "makeRequest": makeRequest,
    "Portal": Portal
}*/
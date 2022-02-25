import { makeRequest } from "./makerequest.mjs"
import { logger } from "./logger.mjs"

export class Portal{
        
    constructor(url, username, password, expiration = 300, serverUrl = undefined)
    {
        this.url = url;
        this.username = username;
        this.password = password;
        this.expiration = expiration;
        this.serverUrl = serverUrl;
    }


   connect()
    { 
            const self = this;
            return new Promise( async (resolve, reject) => {
        
                try { 

                    const tokenUrl = self.url + "/sharing/rest/generateToken";
                   
                    const postJson = {
                        username: self.username,
                        password: self.password,
                        referer: "node",
                        expiration: self.expiration,
                        f: "json"
                    }
    
                    //query for token 
                    logger.info("Generating Token Sending POST request..")
                    const result = await makeRequest({method: 'POST', url: tokenUrl, params: postJson });
                    logger.info("Got result.")
                    if (result.error) reject(JSON.stringify(result.error))
                    self.token = result.token;
             
                    await self.updateServices ();

                    resolve(self.token)
                  
            }
            catch(ex){
                logger.error(ex?.status?.message)
                console.error(ex?.status?.errno)
                reject(`Failed to connect to portal, check your username or password or add --verify false if you are using a self-signed certificate. Normally a production system should have a valid certificate signed by a CA and you should NOT disable verification in that case.) \n\n${ex}`)
            }

            }
            );
       
    }
 
    async updateServices () {
        const self = this;
        return new Promise( async (resolve, reject) => {
            //if the user specified a serverUrl no need to do anything
            if (self.serverUrl !== undefined) {
                logger.info(`Using server ${self.serverUrl} supplied in the --server parameter`)
                resolve(self.serverUrl);
                return;
            }

            //else we need to calculate it
            try {

                const postJsonServers= {
                    f: "json",
                    token: self.token
                }
        
                const serversUrl =  self.url + "/sharing/rest/portals/self/servers"
                logger.info( "About to query federated servers");
                    
                //query for federated servers.
                const servers = await makeRequest({method: 'POST', url: serversUrl, params: postJsonServers });
                
                //if we don't have any federated servers quit.
                if (servers.servers.length === 0) 
                    {
                        reject( "No federeated servers");
                    return
                }
                
                //if we have more than one then we let the user pick.
                if (servers.servers.length > 1){
                    let serverUrls = "";
                    servers.servers.forEach(s => serverUrls += '\n  * ' + s.url + '\n' ) 
                    reject("more than one federated server found, run the command with --server and specify one of the servers below\n" + serverUrls)
                }
                this.serverUrl = servers.servers[0].url;
                resolve(self.serverUrl)
                logger.info(`Found one federate server, using server url ${self.serverUrl} by default`)
            }
        catch(ex){
            logger.error(ex)
            reject(ex)
            }       
         });

    } 

    //get the feature service definition 
    async serviceDef(serviceName) {
        this.token = this.token;
        const serviceUrl =    `${this.serverUrl}/rest/services/${serviceName}/FeatureServer`
        logger.info(`Services URL ${serviceUrl}`)
        const postJson = {
            f: "json",
            token: this.token
        }
        //query for service definition
        return makeRequest({method: 'POST', url: serviceUrl, params: postJson });
    }

    async services () {
        
        const servicesUrl = this.serverUrl + "/rest/services"
        logger.info(`about to print services, server url ${this.serverUrl}`)        
        logger.info(`Services url ${servicesUrl}`);

        return new Promise( 

           async (resolve, reject) => {

                try {
                    const postJson = {
                        token: this.token,
                        f: "json"
                    }
                    
                    let allServices = []
                    const services = await makeRequest({method: 'POST', url: servicesUrl, params: postJson })
                    allServices = allServices.concat(services.services);
                    const folders = services.folders;
                    for (let f = 0; f < folders.length; f++)
                     {
                        const folderUrl = servicesUrl + "/" + folders[f];
                        const folderServices = await makeRequest({method: 'POST', url: folderUrl, params: postJson })
                        allServices = allServices.concat(folderServices.services)
                    }
                        
                         
                    resolve({"services": allServices});
                }
                catch(ex) {
                    reject(ex) 
                }

            }


        );
     
   
    }

    

}




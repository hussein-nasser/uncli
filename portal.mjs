import { makeRequest } from "./makerequest.mjs"
import { logger } from "./logger.mjs"

export class Portal{
        
    constructor(url, username, password, expiration = 300)
    {
        this.url = url;
        this.username = username;
        this.password = password;
        this.expiration = expiration;
        this.serverUrl = "bad";
    }


   connect()
    { 
            const self = this;
            return new Promise( async (resolve, reject) => {
        
                try { 

                    //https://utilitynetwork.esri.com/portal/sharing/rest/portals/self/servers?f=json
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
                logger.error(ex.status.message)
                console.error(ex.status.errno)
                reject(`Failed to connect to portal, check your username or password or add --verify false if you are using a self-signed certificate. Normally a production system should have a valid certificate signed by a CA and you should NOT disable verification in that case.)`)
            }

            }
            );
       
    }
 
    async updateServices () {

        try {

            const postJsonServers= {
                f: "json",
                token: this.token
            }
    
            const serversUrl =  this.url + "/sharing/rest/portals/self/servers"
            logger.info( "About to query federated servers");
                  
            //query for federated servers.
            const servers = await makeRequest({method: 'POST', url: serversUrl, params: postJsonServers });
            
            //get the first one
            if (servers.servers.length === 0) 
                reject( "No federeated servers");
    
            this.serverUrl = servers.servers[0].url;
            logger.info(`Found server url ${this.serverUrl}`)
        }
       catch(ex){
           logger.error(ex)
       }

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
             
                    const services = await makeRequest({method: 'POST', url: servicesUrl, params: postJson })
                    resolve(services);
                }
                catch(ex) {
                    reject(ex) 
                }

            }


        );
     
   
    }

    

}




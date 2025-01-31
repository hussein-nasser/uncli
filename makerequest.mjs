
 
export function makeRequest (opts) {
   
   return new Promise(async function (resolve, reject) {

       try{

      
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
 
        let jsonRes
        let agent;
        let f;
        
        try {
            
            let nodeFetch = await import ("node-fetch");
            f = nodeFetch.default;
        }
        catch(ex) {
            f = fetch;
        } 
        //set a proxy if one exists 
          
        if (process.env['HTTPS_PROXY'])
            {
                try {
                    const HttpsProxyAgent = await import ('https-proxy-agent')
                    agent = new HttpsProxyAgent.HttpsProxyAgent(process.env['HTTPS_PROXY'])
                }
                catch (ex){
                    agent = undefined;
                }
               
            }

        const options =  {
            "method" : opts.method,
             "headers":  headers,
             "body": params
        }

        if (agent)
            options.agent = agent;

        const result = await f(opts.url,options);

        jsonRes  = await result.json();
        
        if (typeof jsonRes !== "object") 
            jsonRes = JSON.parse(jsonRes);

 
        resolve(jsonRes);
    
        }
        catch(ex)
        {
            reject({
                status: ex,
                statusText: "error"
                })        
        }

 
});
}

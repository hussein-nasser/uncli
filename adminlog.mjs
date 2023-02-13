'use strict';
//Author : Hussein Nasser
//Date   : Oct-13-2021
//Twitter: @hnasr

export class AdminLog {

    constructor(token, serverUrl)
    {   
        this.adminServerUrl =   serverUrl + "/admin";
        this.token = token;         
    }

    async getFetch() {
        try {
            const nodeFetch = await import ("node-fetch");
            return nodeFetch.default;
        }
        catch(ex) {
            return fetch;
        }
    }
    async query (codes, serviceName ="*", pageSize = 100000, startTime = null, endTime = null, logLevel = "DEBUG") 
    {   
        const url =  this.adminServerUrl  + "/logs/query?f=pjson"
        const level =  logLevel
        const filterType="json"
        const token = this.token
        
        let filter = {
            "codes": codes,
            "services": serviceName
        }
        //reset filter if nothing is passed, this will return admin crashes too
        if (codes?.length == 0 && serviceName == "*")
            filter = {};
      
        let queryLogUrl = url + `&token=${token}&level=${level}&filterType=${filterType}&filter=${encodeURIComponent(JSON.stringify(filter))}&pageSize=${pageSize}`
        if (startTime != null)
            queryLogUrl += `&startTime=${startTime}`

        if (endTime != null)
            queryLogUrl += `&endTime=${endTime}`

        //logger.info(queryLogUrl);
        const fetch = await this.getFetch()
        return fetch(queryLogUrl);
    }


}
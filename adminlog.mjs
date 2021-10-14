'use strict';
//Author : Hussein Nasser
//Date   : Oct-13-2021
//Twitter: @hnasr
import fetch from "node-fetch";
import { logger } from "./logger.mjs"

export class AdminLog {

    constructor(token, serverUrl)
    {   
        this.adminServerUrl =   serverUrl + "/admin";
        this.token = token;         
    }

    query (codes, serviceName ="*", pageSize = 100000, startTime = null, endTime = null) 
    {   
        const url =  this.adminServerUrl  + "/logs/query?f=pjson"
        const level = "DEBUG"
        const filterType="json"
        const token = this.token
        const filter = {
            "codes": codes,
            "services": serviceName
        }
      
        let queryLogUrl = url + `&token=${token}&level=${level}&filterType=${filterType}&filter=${encodeURIComponent(JSON.stringify(filter))}&pageSize=${pageSize}`
        if (startTime != null)
            queryLogUrl += `&startTime=${startTime}`

        if (endTime != null)
            queryLogUrl += `&endTime=${endTime}`

        //logger.info(queryLogUrl);
        return fetch(queryLogUrl);
    }


}
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

    query (codes, serviceName ="*", pageSize = 10000) 
    {
        const url =  this.adminServerUrl  + "/logs/query?f=pjson"
        const level = "DEBUG"
        const filterType="json"
        const token = this.token
        const filter = {
            "codes": codes,
            "services": serviceName
        }
      
        const queryLogUrl = url + `&token=${token}&level=${level}&filterType=${filterType}&filter=${encodeURIComponent(JSON.stringify(filter))}&pageSize=${pageSize}`
        logger.info(queryLogUrl);
        return fetch(queryLogUrl);
    }


}
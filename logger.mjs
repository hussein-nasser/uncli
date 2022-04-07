const logger = {}
logger.info = console.log
logger.error = console.error

export default logger;

/*
import  winston  from "winston"

export const logger = winston.createLogger();
 
logger.add(
    new winston.transports.Console({"format": winston.format.json()})
  );
 */
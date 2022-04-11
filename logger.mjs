const logger = {}
logger.info = m => console.log (`${shortDate()}: ${m}`)
logger.error =m => console.error (`${shortDate()}: ${m}`)

export default logger;

function shortDate()
{

  const t = new Date();
  const date = ('0' + t.getDate()).slice(-2);
  const month = ('0' + (t.getMonth() + 1)).slice(-2);
  const year = t.getFullYear();
  const hours = ('0' + t.getHours()).slice(-2);
  const minutes = ('0' + t.getMinutes()).slice(-2);
  const seconds = ('0' + t.getSeconds()).slice(-2);
  const time = `${month}/${date}/${year}:${hours}:${minutes}:${seconds}`;
  return time;
}

/*
import  winston  from "winston"

export const logger = winston.createLogger();
 
logger.add(
    new winston.transports.Console({"format": winston.format.json()})
  );
 */
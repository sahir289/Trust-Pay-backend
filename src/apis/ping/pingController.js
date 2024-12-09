import Logger from "../../utils/logger.js";
import pingService from "./pingService.js";

const logger = new Logger();

class pingController{
    async ping(req, res){
        try{
            const data = await pingService.ping;
            logger.log('getting ping response', 'info', data);
            return res.status(200).json(data);
        }catch(error){
            logger.log('error getting', 'error', error);
        }
    }

}

export default new pingController();
import Logger from "../../utils/logger.js";
import pingDao from "./pingDao.js";

const logger = new Logger();

class pingService{
    async ping(req, res){
        const data = await pingDao.ping;
        logger.log('getting ping response', 'info', data);
        return res.status(200).json(data);
    }

}

export default new pingService();
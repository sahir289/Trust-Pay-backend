import Logger from "../../utils/logger.js";

const logger = new Logger();

class pingDao{
    async ping(req, res){
        const data =  res.status(200).json({message: 'pong'})
        logger.log('getting ping response', 'info', data);
        return res.status(200).json(data);
    }

}

export default new pingDao();
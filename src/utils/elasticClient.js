// elasticClient.js
import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: "http://localhost:9200",
//   auth: {                // it is optional if you have security disabled (specifically from ec2 instance)
//     username: "elastic", // currently we don't have any user credentials set up
//     password: "your_password"
//   }
});

export default client;

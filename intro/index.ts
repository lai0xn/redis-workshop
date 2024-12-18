import { createClient } from 'redis';

const client = await createClient()
  .on('error', err => console.log('Redis Client Error', err))
  .connect();

await client.set('key', 'value');
const value = await client.get('key');

console.log(value)


await client.hSet("user",{
	username:"lai0xn",
	name:"Aymen Charfaoui"
})


const user = await client.hGetAll("user")

console.log(user.username)

await client.disconnect();

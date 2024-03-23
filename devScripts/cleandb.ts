import { close_pool, resetTable } from "../src/TA-NK_database/LFT-R.js"



export const cleandb = async () => {

console.log("Passo la prima mano")

	await resetTable("data")
	await resetTable("database_metadata")
	await resetTable("source_thread")
	await resetTable("source_telegram")
	await resetTable("source")
	await resetTable("origin_history")
	await resetTable("author")
	await resetTable("database_metadata")
	await resetTable("origin")
	await resetTable("forum_path")

	console.log("Passo la seconda mano")

	await resetTable("data")
	await resetTable("database_metadata")
	await resetTable("source_thread")
	await resetTable("source_telegram")
	await resetTable("source")
	await resetTable("origin_history")
	await resetTable("author")
	await resetTable("database_metadata")
	await resetTable("origin")
	await resetTable("forum_path")

	console.log("Dai, par en bel mestier")

}

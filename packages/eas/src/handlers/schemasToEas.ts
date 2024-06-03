import fs from "node:fs";
import { z } from "zod";
import { schemaRegistry } from "../services/eas";
import * as path from "node:path";

// EAS schema is an array of [type, name] tuples. E.g. "uint256 eventId, uint8 voteIndex"
const EasSchemaSchema = z.object({
	name: z.string(),
	description: z.string(),
	values: z
		.object({
			type: z.string(),
			name: z.string(),
		})
		.array(),
	UID: z.string().optional(),
	parsed: z.string().optional(),
});

export type EasSchema = z.infer<typeof EasSchemaSchema>;

export const schemasToEas = async (filePath: string, force?: boolean) => {
	const _schemaRegistry = schemaRegistry();
	// Read the JSON file
	const _path = path.join(process.cwd(), "src", filePath);
	const data = fs.readFileSync(_path, "utf-8");

	// Parse the file content into an array of Metric objects
	const schemas: EasSchema[] = JSON.parse(data).map((schema: unknown) => {
		return EasSchemaSchema.parse(schema);
	});

	let updated = false;

	// Iterate over the array and store each metric using the EAS service
	const updatedMetrics = await Promise.all(
		schemas.map(async (schema) => {
			// Skip if the metric already has a UID
			if (!force && schema?.UID) {
				return;
			}

			const schemaToStore = schema.values
				.map(({ type, name }) => `${type} ${name}`)
				.join(", ");

			console.log(schemaToStore);

			const tx = await _schemaRegistry.register({
				schema: schemaToStore,
				resolverAddress: "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0",
				revocable: false,
			});

			const uid = await tx.wait();
			schema.parsed = schemaToStore;
			schema.UID = uid; // Attach the UID to the metric object

			console.log(`Stored schema with UID ${uid}`);
			updated = true;
			return schema;
		}),
	);

	// Write the updated metrics back to the JSON file
	if (updated) fs.writeFileSync(_path, JSON.stringify(updatedMetrics, null, 2));
};
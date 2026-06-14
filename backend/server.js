import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { AzureKeyCredential, SearchClient } from '@azure/search-documents';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = 3001;

const {
	AZURE_SEARCH_ENDPOINT,
	AZURE_SEARCH_INDEX,
	AZURE_SEARCH_KEY,
	GITHUB_TOKEN,
} = process.env;

function requireEnv(value, name) {
	if (!value) {
		throw new Error(`${name} is required`);
	}

	return value;
}

const searchClient = new SearchClient(
	requireEnv(AZURE_SEARCH_ENDPOINT, 'AZURE_SEARCH_ENDPOINT'),
	requireEnv(AZURE_SEARCH_INDEX, 'AZURE_SEARCH_INDEX'),
	new AzureKeyCredential(requireEnv(AZURE_SEARCH_KEY, 'AZURE_SEARCH_KEY')),
);

const openai = new OpenAI({
	apiKey: requireEnv(GITHUB_TOKEN, 'GITHUB_TOKEN'),
	baseURL: 'https://models.inference.ai.azure.com',
});

app.use(cors());
app.use(express.json());

async function getLore(characterName, userMessage) {
	const query = `${characterName} ${characterName} ${characterName} ${userMessage}`.trim();
	const searchResults = await searchClient.search(query, { top: 1 });

	for await (const result of searchResults.results) {
		return result.document ?? result;
	}

	return null;
}

function buildSystemPrompt(lore) {
	const parsedLore = (() => {
		if (!lore?.snippet) {
			return {};
		}

		if (typeof lore.snippet === 'string') {
			try {
				return JSON.parse(lore.snippet);
			} catch {
				return {};
			}
		}

		if (typeof lore.snippet === 'object') {
			return lore.snippet;
		}

		return {};
	})();

	const characterName = lore?.name ?? parsedLore.name ?? lore?.characterName ?? 'the character';
	const speakingStyle = parsedLore.speaking_style ?? 'Speak naturally and stay in character.';
	const traits = Array.isArray(parsedLore.traits)
		? parsedLore.traits.join(', ')
		: parsedLore.traits ?? 'Unknown';
	const canonicalQuotes = Array.isArray(parsedLore.canonical_quotes)
		? parsedLore.canonical_quotes.join(' | ')
		: parsedLore.canonical_quotes ?? 'None available';
	const keyFacts = Array.isArray(parsedLore.key_facts)
		? parsedLore.key_facts.join(' | ')
		: parsedLore.key_facts ?? 'None available';

	return [
		`You are ${characterName} from the Harry Potter universe.`,
		`Stay fully in character and answer as ${characterName}.`,
		`Speaking style: ${speakingStyle}`,
		`Traits: ${traits}`,
		`Canonical quotes: ${canonicalQuotes}`,
		`Key facts: ${keyFacts}`,
		'If the user asks something outside known lore, respond as the character would, without breaking character.',
	].join('\n');
}

app.get('/health', (request, response) => {
	response.json({ ok: true });
});

app.post('/chat', async (request, response) => {
	try {
		const { character, message } = request.body ?? {};

		if (!character || !message) {
			return response.status(400).json({ error: 'character and message are required' });
		}

		const lore = await getLore(character, message);
        console.log("LORE RETURNED:", JSON.stringify(lore, null, 2)); // add this
		const systemPrompt = buildSystemPrompt(lore);
        console.log("SYSTEM PROMPT:", systemPrompt); // add this

		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: message },
			],
		});

		const reply = completion.choices?.[0]?.message?.content ?? '';

		return response.json({ reply });
	} catch (error) {
		console.error('Chat endpoint error:', error);
		return response.status(500).json({ error: 'Failed to generate reply' });
	}
});

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

export { app, buildSystemPrompt, getLore };

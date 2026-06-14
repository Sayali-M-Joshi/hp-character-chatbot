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


function getBlobSlug(characterName, suffix) {
	const normalizedName = characterName.trim().toLowerCase();

	if (normalizedName === 'hermione granger') {
		return `hermione-granger-${suffix}`;
	}

	if (normalizedName === 'harry potter') {
		return `harry-potter-${suffix}`;
	}

	if (normalizedName === 'ron weasley') {
		return `ron-weasley-${suffix}`;
	}

	if (normalizedName === 'draco malfoy') {
		return `draco-malfoy-${suffix}`;
	}

	if (normalizedName === 'neville longbottom') {
		return `neville-longbottom-${suffix}`;
	}

	if (normalizedName === 'ginny weasley') {
		return `ginny-weasley-${suffix}`;
	}

	if (normalizedName === 'luna lovegood') {
		return `luna-lovegood-${suffix}`;
	}

	return `${normalizedName.replace(/\s+/g, '-')}-${suffix}`;
}

function getBlobUrl(characterName, suffix) {
	return `https://hphackathonstore.blob.core.windows.net/hp-characters/${getBlobSlug(characterName, suffix)}`;
}

async function getPersonality(characterName) {
	try {
		const blobUrl = `${getBlobUrl(characterName, 'personality')}.json`;
		const searchResults = await searchClient.search(characterName, {
			filter: `blob_url eq '${blobUrl}'`,
			top: 1,
		});

		for await (const result of searchResults.results) {
			const snippet = result.document?.snippet;

			if (typeof snippet !== 'string') {
				return null;
			}

			try {
				return JSON.parse(snippet);
			} catch {
				return null;
			}
		}

		return null;
	} catch {
		return null;
	}

}

async function getLore(characterName, userMessage) {
	try {
		const blobUrl = `${getBlobUrl(characterName, 'lore')}.json`;
		const searchResults = await searchClient.search(userMessage, {
			filter: `blob_url eq '${blobUrl}'`,
			top: 1,
		});

		for await (const result of searchResults.results) {
			const snippet = result.document?.snippet;
			return typeof snippet === 'string' ? snippet : null;
		}

		return null;
	} catch {
		return null;
	}
}

function buildSystemPrompt(personality, loreSnippet) {
	if (!personality) {
		return '';
	}

	const traits = Array.isArray(personality.traits) ? personality.traits.join(', ') : '';
	const canonicalQuotes = Array.isArray(personality.canonical_quotes)
		? personality.canonical_quotes.join(' | ')
		: '';

	const promptParts = [
		`You are ${personality.name}.`,
		`Speaking style: ${personality.speaking_style ?? 'Speak naturally and stay in character.'}`,
		`Traits: ${traits}`,
		`Canonical quotes: ${canonicalQuotes}`,
	];

	if (loreSnippet) {
		promptParts.push(`Relevant lore for this question: ${loreSnippet}`);
	}

	promptParts.push('Answer as the character and do not break character.');

	return promptParts.join('\n');
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

		const [personality, loreSnippet] = await Promise.all([
			getPersonality(character),
			getLore(character, message),
		]);

        // console.log("PERSONALITY LOADED:", personality ? `✅ ${personality.name} - traits: ${personality.traits?.length}` : "❌ null");
        //console.log("LORE SNIPPET:", loreSnippet ? `✅ ${loreSnippet.slice(0, 100)}...` : "❌ null");


		if (!personality) {
			return response.status(404).json({ error: 'Personality not found' });
		}

		const systemPrompt = buildSystemPrompt(personality, loreSnippet);

        // console.log("SYSTEM PROMPT BUILT:", systemPrompt.slice(0, 200) + "...");

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

export { app, buildSystemPrompt, getLore, getPersonality };

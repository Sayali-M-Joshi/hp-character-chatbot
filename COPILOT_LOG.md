# GitHub Copilot Usage Log

## Entry 1 — Project setup
**Prompt used:** "User: I'm building a Node.js Express backend for a Harry Potter character chatbot. Please generate a complete server.js file that:

- Uses ES module syntax (import/export)
- Loads environment variables from a .env file using dotenv
- Sets up Express with CORS enabled on port 3001
- Has a SearchClient from @azure/search-documents that connects  to Azure AI Search using AZURE_SEARCH_ENDPOINT,  AZURE_SEARCH_INDEX, and AZURE_SEARCH_KEY from .env
- Has an OpenAI client pointed at GitHub Models using baseURL  "https://models.inference.ai.azure.com" and GITHUB_TOKEN from .env
- Has an async function getLore(characterName, userMessage) that 
searches the index with top:1 and returns the first result's document
- Has a function buildSystemPrompt(lore) that parses lore.snippet as JSON and builds a system prompt using the character's name, speaking_style, traits, canonical_quotes, and key_facts fields
- Has a POST /chat endpoint that takes "character" and "message" from the request body, calls getLore, calls buildSystemPrompt, then calls gpt-4o-mini on GitHub Models and returns { reply }
- Has a GET / health check endpoint
- Handles errors with try/catch

**Results:** Initial server.js file. Mostly functional, minor issues like the location of the .env file. Fixed those issues manually.

**Problem:** The Hermione response, when tested with the Thunder Client VS Code extension, did not sound like her speaking style. It turns out Foundry IQ was not returning the proper data, perhaps because it was chunking large JSON files and returning partial snippets that failed JSON.parse. Additionally, the query was not filtering the files via id; instead, it was sending the query and Foundry IQ was simply accessing the most likely file. As a result, data from Harry was returned instead of data from Hermione.

**What I changed:** To avoid choosing the wrong chunk, I split each character file into two; one for personality details and one for lore details. These individual files are small enough to return in one chunk. This ensured the correct data was retrieved. Additionally, I decided to filter using blob_url filter so that Foundry IQ retrieved data from the correct file.I uploaded the 6 new smaller files to Azure Blob Storage and re-ran the indexer.


## Entry 2 - Backend
**Prompt:** Update my server.js for a Harry Potter character chatbot.

Replace the getLore and getPersonality functions with these two new functions that filter by blob_url:

Add getPersonality(characterName) that:
- Uses this logic to build the blob URL:
  "Hermione Granger" -> "hermione-granger-personality"
  "Harry Potter" -> "harry-potter-personality"
  "Ron Weasley" -> "ron-weasley-personality"
- Base blob URL is: 
  "https://hphackathonstore.blob.core.windows.net/hp-characters/" and any character data is added to the end
- Searches Azure AI Search with:
  filter: blob_url eq '{full blob url}.json'
  top: 1
- Parses result.document.snippet as JSON and returns it
- Returns null if nothing found or JSON.parse fails

Add getLore(characterName, userMessage) that:
- Uses same logic but with "-lore" suffix instead of "-personality"
- Searches with userMessage as the search query
- Same blob_url filter approach
- Returns result.document.snippet as a plain string (not parsed)
- Returns null if nothing found

Update buildSystemPrompt(personality, loreSnippet) to:
- Use personality.name, personality.speaking_style, 
personality.traits (array), personality.canonical_quotes (array)
- Add loreSnippet as "Relevant lore for this question:" if it exists
- Return complete system prompt string

Update /chat endpoint to:
- Call getPersonality and getLore in parallel with Promise.all
- Return 404 if personality is null
- Pass both to buildSystemPrompt
- Pass character name and message to their respective functions

**Result:** Working perfectly!


## Entry 3 - Frontend 
**Prompt:** Create a single index.html file inside the frontend folder for a Harry Potter character chatbot. It should have all HTML, CSS, and JavaScript in one file.

The page should have:
- A dark magical theme with background color #0a0a0a, gold accents #d4af37, and parchment text color #f5e6c8
- A title "Meet your Hogwarts Classmates" at the top
- Three character cards at the top. One for Hermione Granger (📚), one for  Harry Potter (⚡), and one for Ron Weasley (♟️), each showing the emoji and name, highlighted in Gryffindor red #740001 when selected, clickable to switch characters
- A chat window below showing messages, user messages right-aligned in gray, character messages left-aligned in dark red
- A text input and Send button at the bottom
- Auto-scroll to the bottom when new messages appear
- A loading indicator that shows "..." while waiting for reply
- When the character is switched, the chat history clears

The JavaScript should:
- Track the selected character (default Hermione Granger)
- On Send, add the user message to the chat immediately
- POST to http://localhost:3001/chat with JSON body containing character and message fields
- Display the reply as the character's response
- Handle errors by showing "Something went wrong. Try again."
- Disable the send button while waiting for a response

Keep everything in one file, no external dependencies.

**Result:** Working perfectly!

**Next step:** Wanted to add a few more characters...

## Entry 4 - Expanding the backend for 4 new characters
**Prompt:** In my server.js, update the getBlobSlug function to add four new characters to the name mapping:
- "Draco Malfoy" -> "draco-malfoy"
- "Neville Longbottom" -> "neville-longbottom"
- "Ginny Weasley" -> "ginny-weasley"
- "Luna Lovegood" -> "luna-lovegood"

**Result:** getBlobSlug function updated successfully

## Entry 5 - Expanding the frontend for 4 new characters
**Prompt:** In my index.html Harry Potter chatbot, add four new characters to the characters array:
- Draco Malfoy, emoji 🐍, subtitle "Cunning, cold, and more 
  complicated than he seems."
- Neville Longbottom, emoji 🌿, subtitle "Clumsy, brave, and 
  braver than anyone expected."
- Ginny Weasley, emoji 🔥, subtitle "Sharp, fearless, and nobody's sidekick."
- Luna Lovegood, emoji 🌙, subtitle "Dreamy, wise, and wonderfully unbothered."

Also update the character card grid so it shows all 7 cards nicely — maybe a responsive grid that wraps automatically.

For Draco use a Slytherin green color #1a472a for his selected card. For Neville, Ginny and Luna keep Gryffindor red #740001. For Luna use Ravenclaw blue #0e1a40.

**Result:** 4 new character cards added, but not a great UI. The cards took up too much of the screen.

## Entry 6 - Refining frontend
**Prompt:** Alter the card display so that the card grid takes up maximum 30% of vertical space in the screen. I want the cards to be more compact and the chat window to be the main focus of the application. The subtitles under each character can be removed or hidden.

**Result:** Made a bit smaller, but not sufficient.

## Entry 7 - Refining frontend

**Prompt:** I want the character cards to be even smaller, and the chat window even larger. 

Specifically:
- the chat window should take up at least 70% of vertical space in the screen
- the emojis for each character can be made smaller, and put beside the character name instead of on top
- all 7 character cards should fit in one line side by side

**Result:** updated successfully!
**What I changed:** Manually went in and altered the vertical height of the character cards to fit my needs, increased the vertical size of the title
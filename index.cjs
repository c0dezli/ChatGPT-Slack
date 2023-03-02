const { App, LogLevel, AwsLambdaReceiver } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');

const SLACK_BOT_ID = ""
const SLACK_SIGNING_SECRET = ""
const SLACK_BOT_TOKEN = ""
const CHATGPT_API_KEY = ""


const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
});
const slackApp = new App({
  token: SLACK_BOT_TOKEN,
  logLevel: LogLevel.DEBUG,
  receiver: awsLambdaReceiver,
});
const slackAPI = new WebClient(SLACK_BOT_TOKEN);

// Handle ChatGPT responses
const getChatGPTResponses = async (prompt, parentMessageId) => {
  const { ChatGPTAPI } = await import('chatgpt')
  const chatGPT = new ChatGPTAPI({ apiKey: CHATGPT_API_KEY });

  return await chatGPT.sendMessage(prompt, { parentMessageId, timeoutMs: 2 * 60 * 1000 })
}


// Get context from a thread
const retriveSlackThread = async (channelId, threadId) => {
  const res = await slackAPI.conversations.replies({channel: channelId, ts: threadId});

  let threadContentStr = "Here is the thread context: \n"

  for (const message of res.messages) {
    const username = (await slackAPI.users.info({user: message.user})).user.real_name
    threadContentStr += `${username}: ${message.text}\n`
  }

  threadContentStr += "thread context ended\n"

  return threadContentStr
}


// Listens to incoming messages directly to the bot
slackApp.message(async ({ message, say }) => {
  try {
    const res = await getChatGPTResponses(message)

    await say({
      text: res.text,
      thread_ts: message.thread_ts || message.ts
    });
  }
  catch (error) {
    console.error(error);
  }
});

// Listens to incoming messages that mentions the bot
slackApp.event('app_mention', async ({ event, context, client, say }) => {
  // Only reply to direct mention
  if (!event.text.includes(`<@${SLACK_BOT_ID}>`)) return
  // Do not reply to self
  if (event.user === SLACK_BOT_ID) return

  try {
    const threadContent = await retriveSlackThread(event.channel, event.thread_ts || event.ts)

    const res = await getChatGPTResponses(threadContent+event.text)
    await say({
      text: res.text,
      thread_ts: event.thread_ts || event.ts
    });
  }
  catch (error) {
    console.error(error);
  }
});

exports.handler = async (event, context, callback) => {
  if (JSON.parse(event.body).challenge){
    console.log("Pass Challenge Mode")
    return {
      statusCode: 200,
      body: JSON.stringify({"challenge": JSON.parse(event.body).challenge}),
    };
  } else {
    const handler = await awsLambdaReceiver.start();
    return handler(event, context, callback);
  }
}
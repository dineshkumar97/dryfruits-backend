
import {
  generateGmailAuthUrl,
  saveGmailOAuthTokens
} from "../services/gmailService.js";

// Start Google OAuth
export const connectGmail = async (req, res, next) => {
  try {
    const authUrl = generateGmailAuthUrl();

    return res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

// Google OAuth callback
export const gmailOAuthCallback = async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(
        "Google Gmail authorization was not completed."
      );
    }

    if (!code || !state) {
      return res.status(400).send(
        "Missing Google authorization code or state."
      );
    }

    const result = await saveGmailOAuthTokens(
      code,
      state
    );

    return res.status(200).send(`
      <html>
        <body style="font-family:Arial;text-align:center;padding:50px">
          <h2>RATASREE Gmail Connected Successfully!</h2>
          <p>Connected account: ${result.accountEmail}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
};

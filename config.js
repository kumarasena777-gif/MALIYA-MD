










                                             // /$$      /$$  /$$$$$$  /$$       /$$$$$$ /$$     /$$ /$$$$$$          /$$      /$$ /$$$$$$$ 
                                             //| $$$    /$$$ /$$__  $$| $$      |_  $$_/|  $$   /$$//$$__  $$        | $$$    /$$$| $$__  $$
                                             //| $$$$  /$$$$| $$  \ $$| $$        | $$   \  $$ /$$/| $$  \ $$        | $$$$  /$$$$| $$  \ $$
                                             //| $$ $$/$$ $$| $$$$$$$$| $$        | $$    \  $$$$/ | $$$$$$$$ /$$$$$$| $$ $$/$$ $$| $$  | $$
                                             //| $$  $$$| $$| $$__  $$| $$        | $$     \  $$/  | $$__  $$|______/| $$  $$$| $$| $$  | $$
                                             //| $$\  $ | $$| $$  | $$| $$        | $$      | $$   | $$  | $$        | $$\  $ | $$| $$  | $$
                                             //| $$ \/  | $$| $$  | $$| $$$$$$$$ /$$$$$$    | $$   | $$  | $$        | $$ \/  | $$| $$$$$$$/
                                             //|__/     |__/|__/  |__/|________/|______/    |__/   |__/  |__/        |__/     |__/|_______/ 
                                                                                                            
                                                                                             
                                                                                             
//                                                                              MALIYA-MD                  







const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
SESSION_ID: process.env.SESSION_ID || "y552mIJR#xJJweP6TG1YhR9YxTEnDHKijwcvVHEfjix1Q_D9mQBg",
ALIVE_IMG: process.env.ALIVE_IMG || "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true",
ALIVE_MSG: process.env.ALIVE_MSG || "*Hello👋 MALIYA-MD BOT Is Alive Now😍*",
BOT_OWNER: '94702135392',
AUTO_STATUS_SEEN: 'true',
AUTO_STATUS_REACT: 'true',
MODE: process.env.MODE || "public",



};

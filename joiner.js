const { Client } = require('discord.js-selfbot-v13');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const MIN_STAY = 2 * 60 * 60 * 1000;
const MAX_STAY = 4 * 60 * 60 * 1000;
const MIN_BREAK = 60 * 1000;
const MAX_BREAK = 5 * 60 * 1000;
const CONNECT_TIMEOUT = 60000;

let shuttingDown = false;
const activeClients = new Set();

function askInt(q) {
  return new Promise(async (resolve) => {
    while (true) {
      const raw = (await ask(q)).trim();
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n > 0) return resolve(n);
      console.log('[!] Sayı gir.');
    }
  });
}

async function runAccount(token, index, guildId, channelId, statusTexts) {
  const log = (msg) => console.log(`[${index}] ${msg}`);
  const client = new Client({ checkUpdate: false });
  activeClients.add(client);

  client.on('ready', async () => {
    log(`${client.user.tag} giriş yaptı.`);

    const setPresence = async () => {
      try {
        await client.user.setPresence({
          status: Math.random() < 0.5 ? 'online' : 'idle',
          activities: [{
            name: statusTexts[Math.floor(Math.random() * statusTexts.length)],
            type: 'CUSTOM',
          }],
        });
      } catch (e) { log(`presence hata: ${e.message}`); }
    };
    await setPresence();

    let guild;
    try {
      guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    } catch (e) {
      log(`Sunucu çekilemedi: ${e.constructor.name}: ${e.message}`);
      activeClients.delete(client);
      return client.destroy();
    }
    if (!guild) {
      log('Sunucu bulunamadı.');
      activeClients.delete(client);
      return client.destroy();
    }

    let channel;
    try {
      channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId);
    } catch (e) {
      log(`Kanal çekilemedi: ${e.constructor.name}: ${e.message}`);
      activeClients.delete(client);
      return client.destroy();
    }
    if (!channel) {
      log('Kanal bulunamadı.');
      activeClients.delete(client);
      return client.destroy();
    }

    log(`Sunucu: ${guild.name} | Kanal: ${channel.name}`);

    let reconnectCount = 0;
    const MAX_RECONNECT = 10;

    while (!shuttingDown) {
      try {
        const vc = await client.voice.joinChannel(channel, {
          selfMute: true,
          selfDeaf: true,
          timeout: CONNECT_TIMEOUT,
        });

        reconnectCount = 0;
        const stay = rand(MIN_STAY, MAX_STAY);
        log(`Kanalda. ${Math.floor(stay / 60000)} dakika kalacak.`);

        let elapsed = 0;
        while (!shuttingDown && elapsed < stay) {
          await sleep(10000);
          elapsed += 10000;
          if (!client.voice.connections.has(guild.id)) {
            log('Bağlantı koptu.');
            break;
          }
        }

        try { client.voice.leaveChannel(guild.id); } catch {}
        if (shuttingDown) break;

        const brk = rand(MIN_BREAK, MAX_BREAK);
        log(`Çıktı. ${Math.floor(brk / 1000)}s bekleyip tekrar girecek.`);
        await sleep(brk);
      } catch (e) {
        reconnectCount++;
        log(`Bağlantı hatası (${reconnectCount}/${MAX_RECONNECT}): ${e.constructor.name}: ${e.message}`);
        if (reconnectCount >= MAX_RECONNECT) {
          log(`${MAX_RECONNECT} kez başarısız, hesap durduruldu.`);
          break;
        }
        await sleep(30000);
      }

      await setPresence();
    }

    activeClients.delete(client);
    try { client.destroy(); } catch {}
    log('Hesap durduruldu.');
  });

  client.on('error', (e) => log(`Client error: ${e.message}`));

  try {
    await client.login(token);
  } catch (e) {
    log(`Login hatası: ${e.constructor.name}: ${e.message}`);
    activeClients.delete(client);
    try { client.destroy(); } catch {}
  }
}

async function setupWizard() {
  console.log('='.repeat(50));
  console.log('  vc-joiner — By & Flamezz');
  console.log('  Her çalıştırmada sorar, kaydetmez');
  console.log('='.repeat(50));

  const guildId = await askInt('Sunucu ID (GUILD_ID): ');
  const channelId = await askInt('Sesli kanal ID (CHANNEL_ID): ');

  console.log('\n[*] Tokenları gir. Her satıra bir, bitince boş Enter.');
  const tokens = [];
  let i = 1;
  while (true) {
    const t = (await ask(`Token #${i} (Enter = bitir): `)).trim();
    if (!t) break;
    tokens.push(t);
    i++;
  }
  if (!tokens.length) {
    console.log('[!] Token girilmedi.');
    process.exit(1);
  }

  console.log('\n[*] Durum yazıları. Boş Enter = varsayılan.');
  const statuses = [];
  let j = 1;
  while (true) {
    const s = (await ask(`Status #${j} (Enter = bitir): `)).trim();
    if (!s) break;
    statuses.push(s);
    j++;
  }
  if (!statuses.length) statuses.push('xxx');

  return { guildId: String(guildId), channelId: String(channelId), tokens, statuses };
}

async function main() {
  const { guildId, channelId, tokens, statuses } = await setupWizard();
  rl.close();

  console.log(`\n[*] ${tokens.length} hesap başlatılıyor.\n`);

  process.on('SIGINT', () => {
    console.log('\n[!] Kapatılıyor...');
    shuttingDown = true;
    for (const c of activeClients) {
      try { c.destroy(); } catch {}
    }
    setTimeout(() => process.exit(0), 3000);
  });

  for (let k = 0; k < tokens.length; k++) {
    if (shuttingDown) break;
    runAccount(tokens[k], k + 1, guildId, channelId, statuses);
    await sleep(rand(10000, 20000));
  }
}

main().catch((e) => {
  console.error(`[!] Kritik hata: ${e.message}`);
  process.exit(1);
});

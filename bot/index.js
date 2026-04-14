const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const CANAL_RESULTADO = '1493454727680364584';
client.once('ready', () => { console.log('Halcon Bot conectado: ' + client.user.tag); });
client.on('messageCreate', async (message) => {
  if (message.webhookId && message.content.includes('NUEVO EXAMEN DE INGRESO')) {
    const nombreMatch = message.content.match(/Nombre IC:\*\* (.+)/);
    const nombre = nombreMatch ? nombreMatch[1].trim() : 'Postulante';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_' + message.id + '_' + nombre).setLabel('APROBAR').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('re_' + message.id + '_' + nombre).setLabel('RECHAZAR').setStyle(ButtonStyle.Danger)
    );
    await message.reply({ content: 'Resultado para **' + nombre + '**:', components: [row] });
  }
});
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const parts = interaction.customId.split('_');
  const accion = parts[0];
  const nombre = parts.slice(2).join('_');
  const canal = await client.channels.fetch(CANAL_RESULTADO);
  if (accion === 'ap') {
    await canal.send('🦅 **APROBADO**\n👤 ' + nombre + '\n✅ Bienvenido al Grupo Halcon! 📅 ' + new Date().toLocaleString('es-AR'));
    await interaction.update({ content: '✅ ' + nombre + ' aprobado.', components: [] });
  } else {
    await canal.send('🦅 **RECHAZADO**\n👤 ' + nombre + '\n❌ Puede reintentar en 2 semanas. 📅 ' + new Date().toLocaleString('es-AR'));
    await interaction.update({ content: '❌ ' + nombre + ' rechazado.', components: [] });
  }
});
client.login(process.env.BOT_TOKEN);

require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const CANAL_RESULTADO   = '1493454727680364584';
const CANAL_UPDATES     = '1493446131663896626';
const ROL_MIEMBRO       = '1459343074378387591';
const CANAL_SANCIONES   = '1492669993958113380';
const CANAL_APELACIONES = '1494145072214839366';
const GITHUB_TOKEN      = process.env.GITHUB_TOKEN;
const GITHUB_REPO       = 'webstudios-ar/halcon-bot';
const GITHUB_FILE       = 'sanciones.json';

const ROLES_AUTORIZADOS = [
  '1474197418890362911',
  '1460348058888830976',
  '1466331349945155615'
];

const RANGOS = {
  '1459343074378387591': 'Miembro Halcón',
  '1460777138129998025': 'Teniente Halcón',
  '1476854892181065739': 'Capitán Halcón',
  '1466328471536930846': 'Comandante Halcón',
  '1466331349945155615': 'Jefe Halcón',
  '1466331228864254002': 'Sub Jefe Halcón',
  '1460348058888830976': 'Director/a Halcón',
};

// ==================== PERSISTENCIA EN GITHUB ====================
let sanciones = {};
let githubFileSha = null;

async function cargarSanciones() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    if (res.status === 404) { console.log('sanciones.json no existe, se creara al primera sancion.'); return; }
    const data = await res.json();
    githubFileSha = data.sha;
    sanciones = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    console.log('Sanciones cargadas desde GitHub:', Object.keys(sanciones).length, 'usuarios');
  } catch (err) { console.error('Error cargando sanciones:', err.message); }
}

async function guardarSanciones() {
  try {
    const content = Buffer.from(JSON.stringify(sanciones, null, 2)).toString('base64');
    const body = { message: 'update sanciones', content };
    if (githubFileSha) body.sha = githubFileSha;
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    githubFileSha = data.content?.sha;
  } catch (err) { console.error('Error guardando sanciones:', err.message); }
}

function getSancion(userId) {
  if (!sanciones[userId]) sanciones[userId] = { warns: 0, strikes: 0, historial: [] };
  return sanciones[userId];
}

// ==================== READY ====================
client.once('ready', async () => {
  console.log('Bot conectado: ' + client.user.tag);
  await cargarSanciones();

  const commands = [
    new SlashCommandBuilder().setName('nuevo').setDescription('Ingresa un nuevo miembro al Grupo Halcon')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a ingresar').setRequired(true)),

    new SlashCommandBuilder().setName('ascender').setDescription('Asciende a un miembro del Grupo Halcon')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a ascender').setRequired(true))
      .addStringOption(o => o.setName('rango').setDescription('Nuevo rango').setRequired(true)
        .addChoices(
          { name: 'Miembro Halcón',    value: '1459343074378387591' },
          { name: 'Teniente Halcón',   value: '1460777138129998025' },
          { name: 'Capitán Halcón',    value: '1476854892181065739' },
          { name: 'Comandante Halcón', value: '1466328471536930846' },
          { name: 'Jefe Halcón',       value: '1466331349945155615' },
          { name: 'Sub Jefe Halcón',   value: '1466331228864254002' },
          { name: 'Director/a Halcón', value: '1460348058888830976' },
        )),

    new SlashCommandBuilder().setName('operativo').setDescription('Anuncia un operativo del Grupo Halcon')
      .addStringOption(o => o.setName('tipo').setDescription('Tipo de operativo').setRequired(true)
        .addChoices(
          { name: '🚐 ALFA — Convoy Blindado',         value: 'ALFA'    },
          { name: '🛡️ BRAVO — Escolta VIP',             value: 'BRAVO'   },
          { name: '🔴 CHARLIE — Control Zona Caliente', value: 'CHARLIE' },
          { name: '🏦 DELTA — Custodia Bancaria',       value: 'DELTA'   },
          { name: '🚗 ECHO — Persecución Alto Riesgo',  value: 'ECHO'    },
          { name: '🆘 FOXTROT — Rescate de Rehén',      value: 'FOXTROT' },
          { name: '🌆 GOLF — Patrulla Urbana',          value: 'GOLF'    },
          { name: '🚨 HOTEL — Respuesta Robo Banco',    value: 'HOTEL'   },
        ))
      .addStringOption(o => o.setName('descripcion').setDescription('Detalles del operativo').setRequired(true))
      .addStringOption(o => o.setName('hora').setDescription('Hora del operativo (ej: 21:00)').setRequired(false)),

    new SlashCommandBuilder().setName('sancionar').setDescription('Aplica una sancion a un miembro del Grupo Halcon')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a sancionar').setRequired(true))
      .addStringOption(o => o.setName('sancion').setDescription('Tipo de sancion').setRequired(true)
        .addChoices(
          { name: '⚠️ Warn 1',    value: 'warn1'    },
          { name: '⚠️ Warn 2',    value: 'warn2'    },
          { name: '🔴 Strike 1',  value: 'strike1'  },
          { name: '🔴 Strike 2',  value: 'strike2'  },
          { name: '💀 Expulsión', value: 'expulsion' },
        ))
      .addStringOption(o => o.setName('motivo').setDescription('Motivo de la sancion').setRequired(true)),

    new SlashCommandBuilder().setName('sanciones').setDescription('Ver el historial de sanciones de un miembro')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a consultar').setRequired(true)),

    new SlashCommandBuilder().setName('apelar-sancion-halcon').setDescription('Apelá tu última sanción del Grupo Halcón'),

  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandos registrados.');
  } catch (err) { console.error('Error registrando comandos:', err); }
});

// ==================== INTERACTIONS ====================
client.on('interactionCreate', async (interaction) => {

  // MODAL APELACION
  if (interaction.isModalSubmit() && interaction.customId === 'modal_apelacion') {
    const texto = interaction.fields.getTextInputValue('texto_apelacion');
    const userId = interaction.user.id;
    const sancion = getSancion(userId);
    const sancionElegida = global.apelacionElegida?.[userId] || sancion.historial.filter(s => !s.nivel.includes('APELAC')).slice(-1)[0];

    if (!sancionElegida) {
      await interaction.reply({ content: '❌ No se encontró la sanción. Usá /apelar-sancion-halcon de nuevo.', ephemeral: true });
      return;
    }

    const mencionSup = ROLES_AUTORIZADOS.map(id => '<@&' + id + '>').join(' ');
    const embed = new EmbedBuilder()
      .setTitle('⚖️ APELACIÓN DE SANCIÓN — GRUPO HALCÓN')
      .setDescription('<@' + userId + '> está apelando su sanción.')
      .addFields(
        { name: '📊 Sanción apelada',       value: sancionElegida.nivel,  inline: true },
        { name: '📋 Motivo original',       value: sancionElegida.motivo, inline: true },
        { name: '👮 Sancionado por',        value: sancionElegida.sancionadorId ? '<@' + sancionElegida.sancionadorId + '>' : 'N/A', inline: true },
        { name: '✍️ Argumento del apelador', value: texto, inline: false }
      )
      .setColor(0xFFAA00).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()
      .setFooter({ text: 'Grupo Halcón  •  Sistema de Apelaciones' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('apel_aceptar_' + userId).setLabel('ACEPTAR APELACIÓN').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('apel_rechazar_' + userId).setLabel('RECHAZAR APELACIÓN').setStyle(ButtonStyle.Danger)
    );

    const canalApel = await client.channels.fetch(CANAL_APELACIONES);
    await canalApel.send({ content: mencionSup, embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Tu apelación fue enviada. El Head del Halcón la revisará a la brevedad.', ephemeral: true });
    return;
  }

  // BOTON ELEGIR SANCION A APELAR
  if (interaction.isButton() && interaction.customId.startsWith('apx-')) {
    const partes = interaction.customId.split('-');
    // formato: apx-IDX-USERID
    const idxReal = parseInt(partes[1]);
    const userId = partes[2];

    // Verificar que es el mismo usuario
    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '❌ Solo vos podés elegir tu sanción.', ephemeral: true });
      return;
    }

    const sancion = getSancion(userId);
    const sancionElegida = sancion.historial[idxReal];
    if (!sancionElegida) {
      await interaction.reply({ content: '❌ No se encontró la sanción. Usá /apelar-sancion-halcon de nuevo.', ephemeral: true });
      return;
    }
    global.apelacionElegida = global.apelacionElegida || {};
    global.apelacionElegida[interaction.user.id] = sancionElegida;

    const modal = new ModalBuilder().setCustomId('modal_apelacion').setTitle('Apelación de Sanción — Grupo Halcón');
    const input = new TextInputBuilder()
      .setCustomId('texto_apelacion')
      .setLabel('Explicá tu caso — única oportunidad de apelar')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describí detalladamente tu argumento. Sé claro y respetuoso.\n\nATENCIÓN: El Head de Halcón aprobará o rechazará tu sanción sin posibilidad de mediación. Esta es tu única oportunidad de apelar.')
      .setMinLength(30).setMaxLength(1000).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  // BOTONES ACEPTAR/RECHAZAR APELACION
  if (interaction.isButton() && (interaction.customId.startsWith('apel_aceptar_') || interaction.customId.startsWith('apel_rechazar_'))) {
    const tieneRol = ROLES_AUTORIZADOS.some(r => interaction.member.roles.cache.has(r));
    if (!tieneRol) { await interaction.reply({ content: '❌ No tenés permisos.', ephemeral: true }); return; }

    const partes = interaction.customId.split('_');
    const decision = partes[1];
    const userId = partes[2];
    const sancion = getSancion(userId);
    const ultima = sancion.historial[sancion.historial.length - 1];

    if (decision === 'aceptar') {
      if (ultima) {
        if (ultima.nivel.includes('STRIKE')) sancion.strikes = Math.max(0, sancion.strikes - 1);
        else if (ultima.nivel.includes('WARN')) sancion.warns = Math.max(0, sancion.warns - 1);
        // Eliminar la sancion apelada del historial
        sancion.historial = sancion.historial.filter((s, i) => i !== sancion.historial.length - 1);
      }
      await guardarSanciones();

      const embedRes = new EmbedBuilder()
        .setTitle('✅ APELACIÓN ACEPTADA')
        .setDescription('<@' + userId + '> — tu apelación fue **ACEPTADA**. La sanción fue revertida.')
        .addFields({ name: '👮 Resuelto por', value: '<@' + interaction.user.id + '>', inline: true })
        .setColor(0x00CC66).setTimestamp()
        .setFooter({ text: 'Grupo Halcón  •  Sistema de Apelaciones' });
      const rowDone = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('done_apel1').setLabel('APELACIÓN ACEPTADA').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('done_apel2').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true)
      );
      await interaction.update({ components: [rowDone] });
      await interaction.followUp({ content: '<@' + userId + '>', embeds: [embedRes] });

    } else {
      sancion.historial.push({ nivel: '❌ APELACIÓN RECHAZADA', motivo: 'Rechazada por <@' + interaction.user.id + '>', fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) });
      await guardarSanciones();

      const embedRes = new EmbedBuilder()
        .setTitle('❌ APELACIÓN RECHAZADA')
        .setDescription('<@' + userId + '> — tu apelación fue **RECHAZADA**. La sanción se mantiene.')
        .addFields({ name: '👮 Resuelto por', value: '<@' + interaction.user.id + '>', inline: true })
        .setColor(0xCC2222).setTimestamp()
        .setFooter({ text: 'Grupo Halcón  •  Sistema de Apelaciones' });
      const rowDone = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('done_apel1').setLabel('ACEPTAR').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('done_apel2').setLabel('APELACIÓN RECHAZADA').setStyle(ButtonStyle.Danger).setDisabled(true)
      );
      await interaction.update({ components: [rowDone] });
      await interaction.followUp({ content: '<@' + userId + '>', embeds: [embedRes] });
    }
    return;
  }

  // BOTONES POSTULACION
  if (interaction.isButton()) {
    const tieneRol = ROLES_AUTORIZADOS.some(r => interaction.member.roles.cache.has(r));
    if (!tieneRol) { await interaction.reply({ content: '❌ No tenés permisos.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const parts = interaction.customId.split('_');
    const accion = parts[0], nombre = parts[2], discordId = parts[3];
    const mencion = discordId ? '<@' + discordId + '>' : '**' + nombre + '**';
    const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const revisor = interaction.member?.displayName || interaction.user.username;
    try {
      const canal = await client.channels.fetch(CANAL_RESULTADO);
      if (accion === 'ap') {
        const embedAp = new EmbedBuilder().setTitle('POSTULANTE APROBADO').setDescription(mencion + ' fue **APROBADO** en el Grupo Halcón.').addFields({ name: '👮  Revisado por', value: revisor, inline: true }).setColor(0x00CC66).setTimestamp().setFooter({ text: 'Grupo Halcón  •  ' + fecha });
        await canal.send({ embeds: [embedAp] });
        const rowDone = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('done1').setLabel('APROBADO por ' + revisor).setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId('done2').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true));
        await interaction.editReply({ components: [rowDone] });
      } else {
        const embedRe = new EmbedBuilder().setTitle('POSTULANTE RECHAZADO').setDescription(mencion + ' fue **RECHAZADO** en el Grupo Halcón.').addFields({ name: '👮  Revisado por', value: revisor, inline: true }).setColor(0xCC2222).setTimestamp().setFooter({ text: 'Grupo Halcón  •  ' + fecha });
        await canal.send({ embeds: [embedRe] });
        const rowDone = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('done1').setLabel('APROBAR').setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId('done2').setLabel('RECHAZADO por ' + revisor).setStyle(ButtonStyle.Danger).setDisabled(true));
        await interaction.editReply({ components: [rowDone] });
      }
    } catch (error) { console.error('Error:', error); }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const tieneRol = ROLES_AUTORIZADOS.some(r => interaction.member.roles.cache.has(r));
  const revisor = interaction.member?.displayName || interaction.user.username;

  // /apelar-sancion-halcon
  if (interaction.commandName === 'apelar-sancion-halcon') {
    const sancion = getSancion(interaction.user.id);
    const historial = sancion.historial.filter(s => !s.nivel.includes('APELAC'));
    if (historial.length === 0) { await interaction.reply({ content: '❌ No tenés sanciones registradas para apelar.', ephemeral: true }); return; }

    const ultimas = historial.slice(-5);
    const btns = ultimas.map((s, i) => {
      // Guardar el indice real en el historial completo para recuperarla despues
      const idxReal = sancion.historial.indexOf(s);
      return new ButtonBuilder()
        .setCustomId('apx-' + idxReal + '-' + interaction.user.id)
        .setLabel(s.nivel.replace(/[🚨⚠️🔴💀✅❌\ufe0f]/gu, '').trim().substring(0, 50))
        .setStyle(ButtonStyle.Secondary);
    });
    const row = new ActionRowBuilder().addComponents(btns);

    const descripcion = ultimas.map((s, i) =>
      '**' + (i+1) + '.** ' + s.nivel + (s.sancionadorId ? ' — Sancionado por <@' + s.sancionadorId + '>' : '') + '\n_Motivo: ' + s.motivo + '_ | ' + s.fecha
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('⚖️ ¿Cuál sanción querés apelar?')
      .setDescription(descripcion + '\n\n> Elegí una de las opciones para continuar.')
      .setColor(0xFFAA00)
      .setFooter({ text: 'Grupo Halcón  •  Sistema de Apelaciones' });

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (!tieneRol) { await interaction.reply({ content: '❌ No tenés permisos para usar este comando.', ephemeral: true }); return; }

  // /nuevo
  if (interaction.commandName === 'nuevo') {
    const usuario = interaction.options.getUser('usuario');
    const miembro = await interaction.guild.members.fetch(usuario.id);
    try {
      await miembro.roles.add(ROL_MIEMBRO);
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder().setTitle('🦅 NUEVO INGRESO — GRUPO HALCÓN').setDescription('<@' + usuario.id + '> ha sido ingresado oficialmente al **Grupo Halcón**.\n¡Bienvenido, Agente!').addFields({ name: '👮 Ingresado por', value: revisor, inline: true }, { name: '🔸 Rango asignado', value: 'Miembro Halcón', inline: true }).setColor(0xFFD700).setThumbnail(usuario.displayAvatarURL()).setTimestamp().setFooter({ text: 'Grupo Halcón  •  Sistema de Ingresos' });
      await canalUp.send({ content: '<@' + usuario.id + '>', embeds: [embed] });
      await interaction.reply({ content: '✅ **' + miembro.displayName + '** ingresado como Miembro Halcón.', ephemeral: true });
    } catch (err) { await interaction.reply({ content: '❌ Error al ingresar al miembro.', ephemeral: true }); }
  }

  // /ascender
  else if (interaction.commandName === 'ascender') {
    const usuario = interaction.options.getUser('usuario');
    const rolId   = interaction.options.getString('rango');
    const miembro = await interaction.guild.members.fetch(usuario.id);
    const rangoNombre = RANGOS[rolId] || 'Rango desconocido';
    try {
      for (const id of Object.keys(RANGOS)) { if (miembro.roles.cache.has(id)) await miembro.roles.remove(id).catch(() => {}); }
      await miembro.roles.add(rolId);
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder().setTitle('🦅 ASCENSO — GRUPO HALCÓN').setDescription('<@' + usuario.id + '> ha sido ascendido en el **Grupo Halcón**.').addFields({ name: '🎖️ Nuevo rango', value: rangoNombre, inline: true }, { name: '👮 Ascendido por', value: revisor, inline: true }).setColor(0xFFD700).setThumbnail(usuario.displayAvatarURL()).setTimestamp().setFooter({ text: 'Grupo Halcón  •  Sistema de Ascensos' });
      await canalUp.send({ content: '<@' + usuario.id + '>', embeds: [embed] });
      await interaction.reply({ content: '✅ **' + miembro.displayName + '** ascendido a ' + rangoNombre + '.', ephemeral: true });
    } catch (err) { await interaction.reply({ content: '❌ Error al ascender. Verificá que el bot tenga el rol más alto.', ephemeral: true }); }
  }

  // /operativo
  else if (interaction.commandName === 'operativo') {
    const tipo = interaction.options.getString('tipo');
    const desc = interaction.options.getString('descripcion');
    const hora = interaction.options.getString('hora') || 'A confirmar';
    const info = { 'ALFA':{ emoji:'🚐',nombre:'CONVOY BLINDADO',nivel:'ALTO RIESGO',color:0xCC2222},'BRAVO':{ emoji:'🛡️',nombre:'ESCOLTA VIP',nivel:'ALTO RIESGO',color:0xCC2222},'CHARLIE':{ emoji:'🔴',nombre:'CONTROL ZONA CALIENTE',nivel:'MEDIO RIESGO',color:0xFFAA00},'DELTA':{ emoji:'🏦',nombre:'CUSTODIA BANCARIA',nivel:'ALTO RIESGO',color:0xCC2222},'ECHO':{ emoji:'🚗',nombre:'PERSECUCIÓN ALTO RIESGO',nivel:'ALTO RIESGO',color:0xCC2222},'FOXTROT':{ emoji:'🆘',nombre:'RESCATE DE REHÉN',nivel:'BAJA PELIGROSIDAD',color:0x2266CC},'GOLF':{ emoji:'🌆',nombre:'PATRULLA URBANA',nivel:'PRESENCIA DIARIA',color:0x2D6A2D},'HOTEL':{ emoji:'🚨',nombre:'RESPUESTA ROBO BANCO',nivel:'ALTO RIESGO',color:0xCC2222}}[tipo];
    const mencionRoles = ROLES_AUTORIZADOS.map(id => '<@&' + id + '>').join(' ');
    const embed = new EmbedBuilder().setTitle(info.emoji + '  OPERATIVO ' + tipo + ' — ' + info.nombre).addFields({ name: '⚠️ Nivel', value: info.nivel, inline: true }, { name: '🕐 Hora', value: hora, inline: true }, { name: '👮 Ordenado por', value: revisor, inline: true }, { name: '📋 Descripción', value: desc, inline: false }).setColor(info.color).setTimestamp().setFooter({ text: 'Grupo Halcón  •  Operaciones' });
    await interaction.reply({ content: mencionRoles, embeds: [embed] });
  }

  // /sancionar
  else if (interaction.commandName === 'sancionar') {
    const usuario = interaction.options.getUser('usuario');
    const motivo  = interaction.options.getString('motivo');
    const tipo    = interaction.options.getString('sancion');
    const sancion = getSancion(usuario.id);

    let nivel = '', color = 0xFFAA00, expulsado = false;
    if (tipo === 'warn1')     { sancion.warns = Math.max(sancion.warns, 1); nivel = '⚠️ WARN 1'; }
    else if (tipo === 'warn2')     { sancion.warns = Math.max(sancion.warns, 2); nivel = '⚠️ WARN 2'; }
    else if (tipo === 'strike1')   { sancion.warns = 0; sancion.strikes = Math.max(sancion.strikes, 1); nivel = '🔴 STRIKE 1'; color = 0xCC2222; }
    else if (tipo === 'strike2')   { sancion.warns = 0; sancion.strikes = Math.max(sancion.strikes, 2); nivel = '🔴 STRIKE 2'; color = 0xCC2222; }
    else if (tipo === 'expulsion') { sancion.warns = 0; sancion.strikes = 3; nivel = '💀 EXPULSIÓN'; color = 0x000000; expulsado = true; }

    sancion.historial.push({ motivo, nivel, fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), sancionadorId: interaction.user.id });
    await guardarSanciones();

    const embed = new EmbedBuilder().setTitle('🚨 SANCIÓN — GRUPO HALCÓN').setDescription('<@' + usuario.id + '> ha recibido una sanción.').addFields({ name: '📊 Nivel', value: nivel, inline: true }, { name: '⚠️ Warns', value: String(sancion.warns), inline: true }, { name: '🔴 Strikes', value: String(sancion.strikes), inline: true }, { name: '📋 Motivo', value: motivo, inline: false }, { name: '👮 Sancionado por', value: '<@' + interaction.user.id + '>', inline: true }).setColor(color).setTimestamp().setFooter({ text: 'Grupo Halcón  •  Sistema de Sanciones' });
    const canalSanc = await client.channels.fetch(CANAL_SANCIONES);
    await canalSanc.send({ content: '<@' + usuario.id + '>', embeds: [embed] });
    await interaction.reply({ content: '✅ Sanción aplicada en #sanciones-halcon.', ephemeral: true });
    if (expulsado) { const m = ROLES_AUTORIZADOS.map(id => '<@&' + id + '>').join(' '); await canalSanc.send({ content: m + ' ⛔ **' + usuario.username + '** llegó a 3 strikes. Se recomienda expulsión inmediata.' }); }
  }

  // /sanciones
  else if (interaction.commandName === 'sanciones') {
    const usuario = interaction.options.getUser('usuario');
    const sancion = getSancion(usuario.id);
    const historial = sancion.historial.length > 0 ? sancion.historial.slice(-5).map((s, i) => '**' + (i+1) + '.** ' + s.nivel + ' — ' + s.motivo + '\n_' + s.fecha + '_').join('\n\n') : 'Sin sanciones registradas.';
    const embed = new EmbedBuilder().setTitle('📋 SANCIONES — ' + usuario.username.toUpperCase()).addFields({ name: '⚠️ Warns', value: String(sancion.warns), inline: true }, { name: '🔴 Strikes', value: String(sancion.strikes), inline: true }, { name: '📜 Últimas sanciones', value: historial, inline: false }).setColor(0xFFD700).setThumbnail(usuario.displayAvatarURL()).setTimestamp().setFooter({ text: 'Grupo Halcón  •  Sistema de Sanciones' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// POSTULACIONES
client.on('messageCreate', async (message) => {
  if (!message.webhookId) return;
  if (!message.content.includes('NUEVO EXAMEN DE INGRESO')) return;
  const c = message.content;
  await message.delete();
  const get = (p) => { const m = c.match(p); return m ? m[1].replace(/\*/g,'').replace(/>/g,'').trim() : 'N/A'; };
  const nombre=get(/Nombre IC:\s*(.+)/i),rango=get(/Rango PFA:\s*(.+)/i),mic=get(/Micrófono:\s*(.+)/i),disp=get(/Disponibilidad:\s*(.+)/i);
  const discordMatch=c.match(/Discord ID[^0-9]*(\d{15,20})/i);
  const discordId=discordMatch?discordMatch[1].trim():null;
  const mencion=discordId?'<@'+discordId+'>':nombre;
  const latasMatch=c.match(/(\d+\/\d+\s*correctos)/i);
  const latas=latasMatch?latasMatch[1]:'N/A';
  const p2=get(/PREGUNTA 2[^\n]*\n([^\n]+)/i),p3=get(/PREGUNTA 3[^\n]*\n([^\n]+)/i),p4=get(/PREGUNTA 4[^\n]*\n([^\n]+)/i),p5=get(/PREGUNTA 5[^\n]*\n([^\n]+)/i),p6=get(/PREGUNTA 6[^\n]*\n([^\n]+)/i),p7=get(/PREGUNTA 7[^\n]*\n([^\n]+)/i),p8=get(/PREGUNTA 8[^\n]*\n([^\n]+)/i),p9=get(/PREGUNTA 9[^\n]*\n([^\n]+)/i);
  const mencionRoles=ROLES_AUTORIZADOS.map(id=>'<@&'+id+'>').join(' ');
  const embed=new EmbedBuilder().setTitle('🦅  NUEVO EXAMEN DE INGRESO — GRUPO HALCÓN  🦅').setColor(0xFFD700).addFields({name:'👤  Nombre IC',value:nombre,inline:true},{name:'🎖️  Rango PFA',value:rango,inline:true},{name:'🎙️  Micrófono',value:mic,inline:true},{name:'📅  Disponibilidad',value:disp,inline:true},{name:'🔗  Discord',value:mencion,inline:true},{name:'🥫  Latas',value:latas,inline:true},{name:'\u200B',value:'\u200B',inline:false},{name:'📋  Preguntas y Respuestas',value:'**P2:** '+(p2||'N/A')+'\n\n**P3:** '+(p3||'N/A')+'\n\n**P4:** '+(p4||'N/A')+'\n\n**P5:** '+(p5||'N/A')+'\n\n**P6:** '+(p6||'N/A')+'\n\n**P7:** '+(p7||'N/A')+'\n\n**P8:** '+(p8||'N/A')+'\n\n**P9:** '+(p9||'N/A'),inline:false}).setTimestamp().setFooter({text:'Grupo Halcón  •  Sistema de Postulaciones'});
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ap_'+Date.now()+'_'+nombre+'_'+(discordId||'')).setLabel('APROBAR').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('re_'+Date.now()+'_'+nombre+'_'+(discordId||'')).setLabel('RECHAZAR').setStyle(ButtonStyle.Danger));
  await message.channel.send({content:mencionRoles,embeds:[embed],components:[row]});
});

client.login(process.env.TOKEN)

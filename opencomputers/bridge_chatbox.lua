-- OpenComputers + Computronics bridge script
-- Забирает сообщения из Telegram-бота и отправляет их в Minecraft чат через chat_box.

local component = require("component")
local event = require("event")
local internet = require("internet")


local BRIDGE_BASE_URL = "http://silvert.software:3000"
local BRIDGE_TOKEN = "e8c05934c1186dbe83405419362892ca2584d2634d37d796f54eaf91de03fa3a"
local TELEGRAM_CHAT_ID = "7620202582"
local POLL_INTERVAL_SEC = 1.0
local BOT_NAME = "TG-Bridge"
local FORWARD_MC_CHAT_TO_TG = true

local function findChatComponent()
  local candidates = { "chat_box", "chatbox", "chat_upgrade" }

  for _, ctype in ipairs(candidates) do
    if component.isAvailable(ctype) then
      local address = component.list(ctype)()
      if address then
        return address, ctype
      end
    end
  end

  return nil, nil
end

local chatAddress, chatType = findChatComponent()
if not chatAddress then
  io.stderr:write("[bridge] Не найден чат-компонент (chat_box/chatbox/chat_upgrade).\n")
  return
end

print("[bridge] Chat component: " .. chatType .. " @ " .. chatAddress)

pcall(function()
  component.invoke(chatAddress, "setName", BOT_NAME)
end)

local function urlEncode(str)
  str = tostring(str)
  str = str:gsub("\n", "\r\n")
  str = str:gsub("([^%w %-_%.~])", function(c)
    return string.format("%%%02X", string.byte(c))
  end)
  str = str:gsub(" ", "+")
  return str
end

local function httpGet(url)
  local handle, reason = internet.request(url)
  if not handle then
    return nil, reason or "request failed"
  end

  local body = ""
  local ok, err = pcall(function()
    for chunk in handle do
      body = body .. chunk
    end
  end)

  if not ok then
    return nil, err or "stream read failed"
  end

  return body, nil
end

local function sendToMinecraftChat(text)
  if text == nil or text == "" then
    return true, nil
  end

  local sendCalls = {
    function()
      return component.invoke(chatAddress, "say", text)
    end,
    function()
      return component.invoke(chatAddress, "sendMessage", text)
    end,
    function()
      return component.invoke(chatAddress, "send", text)
    end,
    function()
      return component.invoke(chatAddress, "message", text)
    end,
    function()
      return component.invoke(chatAddress, "broadcast", text)
    end,
  }

  local lastErr = nil
  for _, callFn in ipairs(sendCalls) do
    local ok, err = pcall(callFn)
    if ok then
      return true, nil
    end
    lastErr = err
  end

  local methodsOk, methodsOrErr = pcall(function()
    return component.methods(chatAddress)
  end)

  if methodsOk and type(methodsOrErr) == "table" then
    local methodNames = {}
    for name in pairs(methodsOrErr) do
      table.insert(methodNames, name)
    end
    table.sort(methodNames)
    return false, "Не найден подходящий метод отправки. Доступные методы: " .. table.concat(methodNames, ", ")
  end

  return false, "Не найден подходящий метод отправки: " .. tostring(lastErr)
end

local function buildPullUrl()
  return string.format(
    "%s/oc/pull-text?token=%s&chatId=%s",
    BRIDGE_BASE_URL,
    urlEncode(BRIDGE_TOKEN),
    urlEncode(TELEGRAM_CHAT_ID)
  )
end

local function buildPushUrl(player, message)
  return string.format(
    "%s/oc/push-text?token=%s&chatId=%s&player=%s&message=%s",
    BRIDGE_BASE_URL,
    urlEncode(BRIDGE_TOKEN),
    urlEncode(TELEGRAM_CHAT_ID),
    urlEncode(player),
    urlEncode(message)
  )
end

local function forwardMinecraftMessageToTelegram(player, message)
  if not FORWARD_MC_CHAT_TO_TG then
    return true, nil
  end

  if player == nil or message == nil then
    return true, nil
  end

  if tostring(player) == BOT_NAME then
    return true, nil
  end

  local _, err = httpGet(buildPushUrl(player, message))
  if err then
    return false, err
  end

  return true, nil
end

print("[bridge] Старт. Опрос: " .. BRIDGE_BASE_URL)

while true do
  local body, err = httpGet(buildPullUrl())


  if err then
    io.stderr:write("[bridge] HTTP ошибка: " .. tostring(err) .. "\n")
  elseif body and body ~= "" then
    local ok, sendErr = sendToMinecraftChat(body)
    if not ok then
      io.stderr:write("[bridge] Ошибка chat_box: " .. tostring(sendErr) .. "\n")
    else
      print("[bridge] > " .. body)
    end
  end

  local _, _, player, message = event.pull(POLL_INTERVAL_SEC, "chat_message")
  if player and message then
    local ok, pushErr = forwardMinecraftMessageToTelegram(player, message)
    if not ok then
      io.stderr:write("[bridge] Ошибка отправки в Telegram: " .. tostring(pushErr) .. "\n")
    end
  end
end

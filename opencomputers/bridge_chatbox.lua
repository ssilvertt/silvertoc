-- OpenComputers + Computronics bridge script
-- Забирает сообщения из Telegram-бота и отправляет их в Minecraft чат через chat_box.

local component = require("component")
local event = require("event")
local internet = require("internet")

-- НАСТРОЙКИ
local BRIDGE_BASE_URL = "http://silvert.software:3000"
local BRIDGE_TOKEN = "change_me_to_long_random_secret"
local TELEGRAM_CHAT_ID = "123456789"
local POLL_INTERVAL_SEC = 1.0

if not component.isAvailable("chat_box") then
  io.stderr:write("[bridge] Не найден компонент chat_box (Computronics).\n")
  return
end

local chatBox = component.chat_box

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
  for chunk in handle do
    body = body .. chunk
  end

  return body, nil
end

local function sendToMinecraftChat(text)
  if text == nil or text == "" then
    return true, nil
  end

  if type(chatBox.say) == "function" then
    local ok, err = pcall(chatBox.say, text)
    if ok then
      return true, nil
    end
    return false, err
  end

  if type(chatBox.sendMessage) == "function" then
    local ok, err = pcall(chatBox.sendMessage, text)
    if ok then
      return true, nil
    end
    return false, err
  end

  return false, "chat_box не поддерживает ни say(), ни sendMessage()"
end

local function buildPullUrl()
  return string.format(
    "%s/oc/pull-text?token=%s&chatId=%s",
    BRIDGE_BASE_URL,
    urlEncode(BRIDGE_TOKEN),
    urlEncode(TELEGRAM_CHAT_ID)
  )
end

print("[bridge] Старт. Опрос: " .. BRIDGE_BASE_URL)

while true do
  local body, err = httpGet(buildPullUrl())

  -- Когда очередь пуста, сервер вернет 204 и body будет пустым.
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

  event.pull(POLL_INTERVAL_SEC)
end

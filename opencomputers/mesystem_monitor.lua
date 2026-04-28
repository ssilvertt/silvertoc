local component = require("component")
local internet = require("internet")
local term = require("term")
local os = require("os")

if not component.isAvailable("me_controller") then
  error("МЭ Контроллер не найден!")
end

local me = component.me_controller

local BRIDGE_BASE_URL = "https://silvert.software/bridge"
local BRIDGE_TOKEN = "e8c05934c1186dbe83405419362892ca2584d2634d37d796f54eaf91de03fa3a"
local CONFIG_REFRESH_SECONDS = 10
local LOOP_DELAY_SECONDS = 5

local monitorItems = {}
local lastConfigRefresh = 0

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

local function normalizeKey(str)
  return string.lower(tostring(str or ""))
end

local function registerResource(dict, key, amount)
  if key == nil then
    return
  end

  local value = tostring(key)
  if value ~= "" then
    dict[value] = amount
    dict[normalizeKey(value)] = amount
  end
end

local function getCurrentResources()
  local items = me.getItemsInNetwork()
  local dict = {}

  for _, item in ipairs(items) do
    local amount = item.size or item.amount or item.count or 0
    registerResource(dict, item.label, amount)
    registerResource(dict, item.name, amount)

    if item.name ~= nil and item.damage ~= nil then
      registerResource(dict, string.format("%s:%s", tostring(item.name), tostring(item.damage)), amount)
    end

    if item.label ~= nil then
      local numericId = tostring(item.label):match("#(%d+)")
      if numericId ~= nil then
        registerResource(dict, numericId, amount)
      end
    end
  end

  return dict
end

local function lookupAmount(currentResources, itemId)
  local directValue = currentResources[itemId]
  if directValue ~= nil then
    return directValue
  end

  return currentResources[normalizeKey(itemId)] or 0
end

local function refreshMonitorLabels(force)
  local now = os.time()
  if not force and (now - lastConfigRefresh) < CONFIG_REFRESH_SECONDS then
    return true
  end

  local body, err = httpGet(BRIDGE_BASE_URL .. "/oc/me-monitor/config-text?token=" .. urlEncode(BRIDGE_TOKEN))
  if err then
    io.stderr:write("[me-monitor] Не удалось получить конфиг: " .. tostring(err) .. "\n")
    return false
  end

  local items = {}
  for line in tostring(body):gmatch("[^\r\n]+") do
    local separatorStart = line:find("\t")
    local itemId
    local displayName

    if separatorStart ~= nil then
      itemId = line:sub(1, separatorStart - 1):match("^%s*(.-)%s*$")
      displayName = line:sub(separatorStart + 1):match("^%s*(.-)%s*$")
    else
      itemId = line:match("^%s*(.-)%s*$")
    end

    if itemId ~= nil and itemId ~= "" then
      table.insert(items, {
        itemId = itemId,
        displayName = displayName ~= nil and displayName ~= "" and displayName or itemId,
      })
    end
  end

  monitorItems = items
  lastConfigRefresh = now
  return true
end

local function reportAmount(itemId, amount)
  local url = string.format(
    "%s/oc/me-monitor/report?token=%s&label=%s&amount=%s",
    BRIDGE_BASE_URL,
    urlEncode(BRIDGE_TOKEN),
    urlEncode(itemId),
    urlEncode(tostring(amount))
  )

  local _, err = httpGet(url)
  if err then
    io.stderr:write("[me-monitor] Не удалось отправить отчет для '" .. tostring(itemId) .. "': " .. tostring(err) .. "\n")
    return false
  end

  return true
end

local function renderScreen(currentResources)
  term.clear()
  term.setCursor(1, 1)

  print("=== [ ME SYSTEM LIVE MONITOR ] ===")
  print(string.format("Time: %s", os.date("%H:%M:%S")))
  print("----------------------------------")
  print(string.format("%-28s | %-10s", "Resource", "Amount"))
  print("----------------------------------")

  if #monitorItems == 0 then
    print("Нет предметов для мониторинга. Добавь их на сайте.")
  else
    for _, item in ipairs(monitorItems) do
      local amount = lookupAmount(currentResources, item.itemId)
      print(string.format("%-28s | %-10d", item.displayName, amount))
    end
  end

  print("----------------------------------")
  print("Окно обновляется автоматически. Ctrl+C для выхода.")
end

term.clear()
refreshMonitorLabels(true)

while true do
  refreshMonitorLabels(false)

  local currentResources = getCurrentResources()
  renderScreen(currentResources)

  for _, item in ipairs(monitorItems) do
    local amount = lookupAmount(currentResources, item.itemId)
    reportAmount(item.itemId, amount)
  end

  os.sleep(LOOP_DELAY_SECONDS)
end
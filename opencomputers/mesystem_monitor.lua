local component = require("component")
local internet = require("internet")
local term = require("term")
local os = require("os")

if not component.isAvailable("me_controller") then
  error("МЭ Контроллер не найден!")
end

local me = component.me_controller

local BRIDGE_BASE_URL = "http://silvert.software/bridge"
local BRIDGE_TOKEN = "e8c05934c1186dbe83405419362892ca2584d2634d37d796f54eaf91de03fa3a"
local CONFIG_REFRESH_SECONDS = 10
local LOOP_DELAY_SECONDS = 5

local monitorLabels = {}
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

local function getCurrentResources()
  local items = me.getItemsInNetwork()
  local dict = {}

  for _, item in ipairs(items) do
    local amount = item.size or item.amount or item.count or 0
    dict[item.label] = amount
  end

  return dict
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

  local labels = {}
  for line in tostring(body):gmatch("[^\r\n]+") do
    local label = line:match("^%s*(.-)%s*$")
    if label ~= "" then
      table.insert(labels, label)
    end
  end

  monitorLabels = labels
  lastConfigRefresh = now
  return true
end

local function reportAmount(label, amount)
  local url = string.format(
    "%s/oc/me-monitor/report?token=%s&label=%s&amount=%s",
    BRIDGE_BASE_URL,
    urlEncode(BRIDGE_TOKEN),
    urlEncode(label),
    urlEncode(tostring(amount))
  )

  local _, err = httpGet(url)
  if err then
    io.stderr:write("[me-monitor] Не удалось отправить отчет для '" .. tostring(label) .. "': " .. tostring(err) .. "\n")
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

  if #monitorLabels == 0 then
    print("Нет предметов для мониторинга. Добавь их на сайте.")
  else
    for _, label in ipairs(monitorLabels) do
      local amount = currentResources[label] or 0
      print(string.format("%-28s | %-10d", label, amount))
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

  for _, label in ipairs(monitorLabels) do
    local amount = currentResources[label] or 0
    reportAmount(label, amount)
  end

  os.sleep(LOOP_DELAY_SECONDS)
end
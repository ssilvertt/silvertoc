local component = require("component")
local internet = require("internet")
local gpu = component.gpu
local system = require("System")

local BRIDGE_BASE_URL = "https://silvert.software/bridge"
local BRIDGE_TOKEN = "e8c05934c1186dbe83405419362892ca2584d2634d37d796f54eaf91de03fa3a"
local TARGET_WIDTH = 160
local TARGET_HEIGHT = 29
local REFRESH_SECONDS = 8

local items = {}
local lastRefresh = 0

local function utf8Length(str)
  local value = tostring(str)
  local count = 0
  local index = 1

  while index <= #value do
    local byte = string.byte(value, index)

    if byte < 128 then
      index = index + 1
    elseif byte < 224 then
      index = index + 2
    elseif byte < 240 then
      index = index + 3
    else
      index = index + 4
    end

    count = count + 1
  end

  return count
end

local function padRight(text, width)
  local value = tostring(text)
  local displayWidth = utf8Length(value)
  if displayWidth >= width then
    return value
  end

  return value .. string.rep(" ", width - displayWidth)
end

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

local function clampResolution()
  local maxWidth, maxHeight = gpu.maxResolution()
  local width = math.min(TARGET_WIDTH, maxWidth)
  local height = math.min(TARGET_HEIGHT, maxHeight)

  if gpu.getResolution() ~= width or select(2, gpu.getResolution()) ~= height then
    pcall(function()
      gpu.setResolution(width, height)
    end)
  end

  return width, height
end

local function clear(color)
  gpu.setBackground(color)
  gpu.setForeground(0xFFFFFF)
  local width, height = gpu.getResolution()
  gpu.fill(1, 1, width, height, " ")
end

local function drawBox(x, y, width, height, background, border, title)
  gpu.setBackground(background)
  gpu.setForeground(border)
  gpu.fill(x, y, width, height, " ")

  if width >= 2 and height >= 2 then
    gpu.fill(x, y, width, 1, "─")
    gpu.fill(x, y + height - 1, width, 1, "─")
    gpu.fill(x, y, 1, height, "│")
    gpu.fill(x + width - 1, y, 1, height, "│")
    gpu.set(x, y, "┌")
    gpu.set(x + width - 1, y, "┐")
    gpu.set(x, y + height - 1, "└")
    gpu.set(x + width - 1, y + height - 1, "┘")
  end

  if title ~= nil and title ~= "" then
    gpu.setForeground(0xB9C2D0)
    gpu.set(x + 2, y, title)
  end
end

local function parseItems(body)
  local parsed = {}

  for line in tostring(body):gmatch("[^\r\n]+") do
    local itemId, displayName, amountText = line:match("^([^\t]+)\t([^\t]+)\t?(.*)$")
    if itemId ~= nil and itemId ~= "" then
      table.insert(parsed, {
        itemId = itemId,
        displayName = displayName ~= nil and displayName ~= "" and displayName or itemId,
        amount = tonumber(amountText) or 0,
      })
    end
  end

  return parsed
end

local function refreshData()
  local body, err = httpGet(BRIDGE_BASE_URL .. "/oc/me-monitor/config-text?token=" .. urlEncode(BRIDGE_TOKEN))
  if not body then
    return false, err
  end

  items = parseItems(body)
  lastRefresh = system.getTime()
  return true
end

local function formatTime(timestamp)
  if type(os) == "table" and type(os.date) == "function" then
    return os.date("%H:%M:%S", timestamp)
  end

  return string.format("%.0f", timestamp)
end

local function drawDashboard()
  local width, height = gpu.getResolution()
  clear(0x10141A)

  drawBox(1, 1, width, 4, 0x18202A, 0x4A90E2, "ME SYSTEM DASHBOARD")
  gpu.setForeground(0xFFFFFF)
  gpu.set(3, 2, "Silvertoc • MineOS • live monitor")
  gpu.setForeground(0x8EA4BE)
  gpu.set(3, 3, string.format("Refresh: %ss   Updated: %s   Items: %d", REFRESH_SECONDS, formatTime(lastRefresh), #items))

  local summaryY = 6
  local cardWidth = math.floor((width - 5) / 4)
  local cards = {
    { title = "Предметов", value = tostring(#items), color = 0x2D4A7A },
    { title = "С последним", value = tostring(#items > 0 and items[1].amount or 0), color = 0x2E6A5B },
    { title = "Обновлено", value = formatTime(lastRefresh), color = 0x5C4D89 },
    { title = "Режим", value = "ME live", color = 0x7A4B2D },
  }

  for index, card in ipairs(cards) do
    local x = 1 + (index - 1) * (cardWidth + 1)
    drawBox(x, summaryY, cardWidth, 4, 0x202833, card.color, card.title)
    gpu.setForeground(0xFFFFFF)
    gpu.set(x + 2, summaryY + 2, card.value)
  end

  local tableY = 11
  local tableHeight = height - tableY - 3
  drawBox(1, tableY, width, tableHeight, 0x141A22, 0x3E4B5A, "Список предметов")

  local headerY = tableY + 1
  local nameColumnWidth = math.floor(width * 0.56)
  local idColumnWidth = math.floor(width * 0.24)
  local amountColumnWidth = width - nameColumnWidth - idColumnWidth - 8

  gpu.setForeground(0xC9D4E5)
  gpu.set(3, headerY, padRight("Название", nameColumnWidth))
  gpu.set(3 + nameColumnWidth + 2, headerY, padRight("ID", idColumnWidth))
  gpu.set(width - amountColumnWidth - 3, headerY, padRight("Кол-во", amountColumnWidth))

  gpu.setForeground(0x5B6B7F)
  gpu.fill(2, headerY + 1, width - 2, 1, "─")

  local visibleRows = tableHeight - 3
  for index = 1, math.min(#items, visibleRows) do
    local item = items[index]
    local rowY = headerY + 2 + (index - 1)
    local rowBackground = (index % 2 == 0) and 0x18202A or 0x141A22

    gpu.setBackground(rowBackground)
    gpu.setForeground(0xFFFFFF)
    gpu.fill(2, rowY, width - 2, 1, " ")

    gpu.setForeground(0xE8EEF7)
    gpu.set(3, rowY, padRight(item.displayName, nameColumnWidth))
    gpu.setForeground(0x90A0B6)
    gpu.set(3 + nameColumnWidth + 2, rowY, padRight(item.itemId, idColumnWidth))
    gpu.setForeground(0x7FE08A)

    local amountText = tostring(item.amount)
    local amountX = width - utf8Length(amountText) - 3
    if amountX < 3 then
      amountX = 3
    end
    gpu.set(amountX, rowY, amountText)
  end

  if #items == 0 then
    gpu.setForeground(0x8FA3B7)
    gpu.set(3, headerY + 3, "Список пуст — добавь предметы на сайте, и они появятся здесь.")
  elseif #items > visibleRows then
    gpu.setForeground(0x8FA3B7)
    gpu.set(3, tableY + tableHeight - 1, string.format("Показано %d из %d предметов", visibleRows, #items))
  end

  gpu.setForeground(0x6E7E91)
  gpu.set(width - 29, height, string.format("Last sync %s", formatTime(lastRefresh)))
end

local function run()
  clampResolution()
  clear(0x10141A)

  while true do
    refreshData()
    drawDashboard()
    os.sleep(REFRESH_SECONDS)
  end
end

run()
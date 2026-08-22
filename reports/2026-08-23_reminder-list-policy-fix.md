# Reminder List Policy Fix - 2026-08-23

## User Correction

Pipeline reminders must be added only when the user explicitly asks to add a company or role to the reminder list. The dashboard must not auto-generate reminder rows from target companies, archive records, historical recommendations, or inferred interests.

## Changes

- Added `data/reminders.json` as the explicit reminder-list source.
- Loaded reminders through the shared JSON data layer.
- Changed Pipeline filter label from `持续关注` to `提醒列表`.
- Removed automatic Pipeline rows generated from `data/companies.json`.
- Removed automatic Pipeline rows generated from `data/archive.json`.
- Added regression checks to prevent reminder rows from becoming auto-generated again.

## Image-Based Reminder Entries

The user-provided image "更新目前投递公司" was treated as an explicit current reminder list and added 15 records:

- 外企: 捷普, 派克汉尼汾, 德州仪器, 斯巴特, 大众, 松下, VeSync, 佛吉亚
- 汽车: 赛力斯, 奇瑞, 上汽, 小鹏汽车, 北汽, 追觅, 吉利

## Result

Pipeline reminder rows now come from `data/reminders.json` only. Future reminders require explicit user instruction or a user-provided reminder list.

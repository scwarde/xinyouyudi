# 心有余地

给情绪留一点空间。

这是免注册、本地优先的心理技能产品原型。打开 index.html 或 stress-station.html 即可使用，两份入口内容相同。

## 使用与上传

保持以下文件位于同一目录，上传网站时一并上传：

- index.html、stress-station.html
- styles.css
- data.js、core.js、app.js
- manifest.json、sw.js
- icon.svg、icon-192.png、icon-512.png

无需构建、无需 API 密钥，不要只上传 HTML。

通过 HTTPS 或 localhost 首次联网打开后会缓存资源。安装入口由浏览器提供；双击本地 HTML 可以使用网页，但不会注册 Service Worker。

## 数据

记录存储在当前浏览器的 localStorage。换浏览器、设备或移动本地文件路径，原记录可能不可见。建议从“我的”导出 JSON 备份。JSON 包含私人文字、图片、录音和对话，请妥善保管。

导入先验证格式，再合并本产品记录；不写入无关的 localStorage 键。当前草稿优先保留。CSV 是统计概览，不代替完整 JSON 备份。

旧版 ssScores、ssDaily、ssJournal、ssTrash、ssPracticeFeedback、ssPracticeLogs、ssDoodle、ssChatSession、ssSourceLogs 等记录会迁移。旧键不清空，原始快照另存并随 JSON 导出。原量尺不明的旧自测分数单独回看；无完成时长的旧训练不计为完成。

时间胶囊仅在本地打开时检查日期，没有服务器通知，也不是加密保管箱。录音按钮只在具备 MediaRecorder 和麦克风 API 时出现，仍需实际授权。图片和录音各限制 1 MB，录音最长 30 秒，总容量受浏览器限制。

## 产品边界

PSS-10 回顾过去一个月，0–4 作答，第 4、5、7、8 题反向计分，总分 0–40，不设固定诊断阈值。练习使用独立的 0–10 即时评分。辅助觉察是产品自定义问题，不是标准分量表。

中文题意展示未宣称为经过验证的标准译本。参赛、研究或正式推广前应确认量表与译文许可，并安排专业审阅。

合成声景不是录音，浏览器朗读不是录制语音。陪伴采用本地规则，不伪装大模型。涂鸦反馈仅描述可计算特征，不判断心理状态。产品不用于诊断或紧急救援。

- [Cohen 团队：PSS 用途与使用权限](https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/index.html)
- [WHO：压力管理技能指南](https://www.who.int/publications/i/item/9789240003927)
- [NHS：舒适自然的呼吸练习](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/)

## 原版备份

项目 work/before-rebuild-20261015/ 保留重构前网页和配置。

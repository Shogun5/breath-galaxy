// Interface languages. Keys are the Traditional Chinese source text: [English, Japanese].
const T = {
  '星息': ['Breath Galaxy', '星の息'],
  '讓腦波點亮銀河，跟著波紋呼吸。': ['Let your brainwaves light a galaxy, and breathe with it.', '脳波で銀河を灯し、光に合わせて呼吸する。'],
  '連接 Muse 2': ['Connect Muse 2', 'Muse 2 に接続'],
  '使用模擬資料': ['Use simulated data', 'シミュレーションを使う'],
  'Quest 接收手機資料': ['Receive phone data on Quest', 'Quest でスマホのデータを受信'],
  '歷史紀錄': ['History', '履歴'],
  '怎麼看這片銀河': ['How to read the galaxy', '銀河の見方'],
  '本程式用於放鬆訓練與教學，非醫療器材，不作診斷。資料只存在此裝置。': ['For relaxation training and teaching. Not a medical device and not for diagnosis. Data stays on this device.', 'リラクゼーション訓練と教育用です。医療機器ではなく、診断には使えません。データはこの端末にのみ保存されます。'],
  '本程式用於放鬆訓練與教學，非醫療器材，不作診斷。': ['For relaxation training and teaching. Not a medical device and not for diagnosis.', 'リラクゼーション訓練と教育用です。医療機器ではなく、診断には使えません。'],
  '已連線': ['Connected', '接続済み'],
  '已連線：{0}': ['Connected: {0}', '接続済み：{0}'],
  '設定': ['Settings', '設定'],
  '時間（分鐘）': ['Duration (minutes)', '時間（分）'],
  '自訂': ['Custom', 'カスタム'],
  '目標': ['Goal', '目標'],
  '放鬆': ['Relax', 'リラックス'],
  '專注': ['Focus', '集中'],
  '呼吸同調': ['Breath coherence', '呼吸コヒーレンス'],
  '呼吸頻率': ['Breathing rate', '呼吸数'],
  '次／分': ['per min', '回／分'],
  '吸：吐': ['in : out', '吸：吐'],
  '吸氣比例': ['Inhale ratio', '吸気の割合'],
  '場景': ['Scene', 'シーン'],
  '銀河': ['Galaxy', '銀河'],
  '大腦視角': ['Brain view', '脳ビュー'],
  '顯示': ['Display', '表示'],
  '手機／電腦 3D': ['Phone / computer 3D', 'スマホ／PC 3D'],
  '3D 格式': ['3D format', '3D 形式'],
  '自動判斷': ['Auto', '自動'],
  '全寬 SBS（32:9）': ['Full-width SBS (32:9)', 'フル幅 SBS（32:9）'],
  '半寬 SBS（16:9）': ['Half-width SBS (16:9)', 'ハーフ幅 SBS（16:9）'],
  '互動': ['Interaction', 'インタラクション'],
  '頭部動作帶動銀河或大腦的角度': ['Head movement changes the galaxy or brain angle', '頭の動きで銀河や脳の角度を変える'],
  '聲音': ['Sound', 'サウンド'],
  '生成音樂（節奏鎖定呼吸）': ['Generated music (tempo locked to breathing)', '生成音楽（テンポは呼吸に同期）'],
  '心跳聲': ['Heartbeat sound', '心拍音'],
  '記錄': ['Recording', '記録'],
  '受試者代號（請勿填真實姓名）': ['Participant code (do not use a real name)', '参加者コード（実名は入力しないでください）'],
  '例如 S01': ['e.g. S01', '例：S01'],
  '備註': ['Note', 'メモ'],
  '記錄原始 EEG、PPG 與動作資料': ['Record raw EEG, PPG and motion data', 'EEG・PPG・動きの生データを記録'],
  '開始校準': ['Start calibration', 'キャリブレーション開始'],
  '返回': ['Back', '戻る'],
  '使用說明': ['Guide', '使い方'],
  '訊號校準': ['Signal calibration', '信号キャリブレーション'],
  '閉眼靜坐，': ['Close your eyes,', '目を閉じて座り、'],
  '放鬆下顎。': ['relax your jaw.', 'あごの力を抜く。'],
  '校準中': ['Calibrating', 'キャリブレーション中'],
  '提早完成': ['Finish early', '早めに完了'],
  '進入銀河': ['Enter', '開始する'],
  '等待 Quest': ['Waiting for Quest', 'Quest を待機中'],
  '在 Quest 瀏覽器開啟同一網址，按「Quest 接收手機資料」，輸入：': ['Open this address in the Quest browser, choose “Receive phone data on Quest”, and enter:', 'Quest のブラウザで同じアドレスを開き、「Quest でスマホのデータを受信」を選んで入力：'],
  'Quest 接收': ['Quest receiver', 'Quest で受信'],
  '輸入手機上的代碼': ['Enter the code from your phone', 'スマホのコードを入力'],
  '連線代碼': ['Connection code', '接続コード'],
  '連線': ['Connect', '接続'],
  '進入 VR': ['Enter VR', 'VR に入る'],
  '吸氣': ['Inhale', '吸う'],
  '吐氣': ['Exhale', '吐く'],
  '暫停': ['Pause', '一時停止'],
  '繼續': ['Resume', '再開'],
  '一般': ['Neutral', '通常'],
  '放空': ['Wander', 'ぼんやり'],
  '焦躁': ['Anxious', '焦り'],
  '標記': ['Mark', 'マーク'],
  '重設視角': ['Reset view', '視点リセット'],
  '圖例': ['Legend', '凡例'],
  '結束': ['End', '終了'],
  '再按一次結束': ['Tap again to end', 'もう一度押して終了'],
  '再一次結束': ['Again to end', 'もう一度で終了'],
  '上升': ['Up', '上昇'],
  '下降': ['Down', '下降'],
  '上': ['Up', '上'],
  '下': ['Down', '下'],
  '銀河圖例': ['Galaxy legend', '銀河の凡例'],
  '關閉': ['Close', '閉じる'],
  '四條旋臂': ['Four arms', '4本の腕'],
  '旋臂的長度': ['Arm length', '腕の長さ'],
  '旋臂的寬度': ['Arm width', '腕の幅'],
  '亮度與跳動': ['Brightness and motion', '明るさと動き'],
  '收窄或發散': ['Narrow or scattered', '細い／広がる'],
  '細碎閃爍': ['Fine flicker', '細かなきらめき'],
  '往中心聚攏': ['Drawing inward', '中心への集まり'],
  '中心亮點與旋轉': ['Centre light and rotation', '中心の光と回転'],
  '銀河傾斜': ['Galaxy tilt', '銀河の傾き'],
  '放射光芒': ['Radiating light', '放射する光'],
  '四個感測點各一條：左耳後 TP9、左前額 AF7、右前額 AF8、右耳後 TP10。': ['One for each sensor: TP9 behind the left ear, AF7 on the left forehead, AF8 on the right forehead, TP10 behind the right ear.', 'センサーごとに1本：左耳の後ろ TP9、左の額 AF7、右の額 AF8、右耳の後ろ TP10。'],
  '代表頻率。靠中心是高頻（γ、β），中段是 α，外圍是低頻（θ、δ）。': ['Frequency. High frequencies (γ, β) are near the centre, α in the middle, low frequencies (θ, δ) at the edge.', '周波数を表します。中心付近が高周波（γ、β）、中間が α、外側が低周波（θ、δ）です。'],
  '代表時間。一側是現在，另一側是約 6 秒前，訊號會橫向流過。': ['Time. One side is now, the other about 6 seconds ago; signals flow across.', '時間を表します。片側が現在、反対側が約6秒前で、信号が横に流れます。'],
  '該頻率比您校準時的靜息狀態更強，就更亮、跳得更明顯。': ['Brighter and livelier when that frequency is stronger than your resting calibration.', 'その周波数が安静時より強いほど、明るく大きく動きます。'],
  '代表訊號穩定度。穩定時旋臂收窄、線條乾淨；忽大忽小時顆粒散開。': ['Signal stability. Steady signal gives narrow, clean arms; an unsteady one scatters the particles.', '信号の安定度です。安定すると腕は細く整い、不安定だと粒子が広がります。'],
  '高頻 β（20–30 Hz）相對偏高時，內側星點會細碎閃動。': ['When high β (20–30 Hz) is relatively strong, inner stars flicker.', '高周波 β（20〜30 Hz）が相対的に高いと、内側の星が細かくきらめきます。'],
  '前額 θ 與低頻 β 上升、訊號又穩定時，光往中心收、外圍變淡。': ['When frontal θ and low β rise with a steady signal, light gathers inward and the edge fades.', '前頭部の θ と低周波 β が上がり信号も安定すると、光が中心に集まり外側は淡くなります。'],
  '中心隨心跳脈動，每一拍轉一小段，心跳越快轉得越快。': ['The centre pulses with your heartbeat. Each beat turns the galaxy a little, so a faster heart turns it faster.', '中心は心拍に合わせて脈打ちます。一拍ごとに少し回転し、心拍が速いほど速く回ります。'],
  '跟著您的頭部傾斜，以校準時的姿勢為基準。': ['Follows your head tilt, relative to your calibration posture.', 'キャリブレーション時の姿勢を基準に、頭の傾きに追従します。'],
  '呼吸引導：吸氣時光芒向外延伸，吐氣時變暗並收回中心。': ['Breathing guide: light reaches outward on the inhale, then dims and returns to the centre on the exhale.', '呼吸ガイド：吸うと光が外へ伸び、吐くと暗くなって中心へ戻ります。'],
  '中心': ['Centre', '中心'],
  '位於大腦中央，亮點一樣隨心跳脈動。這只是視覺上的中心，Muse 並沒有測量這個位置。': ['In the middle of the brain, pulsing with your heartbeat. It is only a visual centre; Muse does not measure this location.', '脳の中央にあり、心拍に合わせて脈打ちます。視覚上の中心であり、Muse はこの位置を測定していません。'],
  '各自連到一個感測點：TP9 左耳後、AF7 左前額、AF8 右前額、TP10 右耳後。靠中心是高頻，靠感測點是低頻。': ['Each connects to one sensor: TP9 behind the left ear, AF7 left forehead, AF8 right forehead, TP10 behind the right ear. High frequencies are near the centre, low frequencies near the sensor.', 'それぞれがセンサーにつながります：TP9 左耳の後ろ、AF7 左の額、AF8 右の額、TP10 右耳の後ろ。中心付近が高周波、センサー付近が低周波です。'],
  '腦的角度': ['Brain angle', '脳の角度'],
  '跟著您的頭轉動：前後、左右傾斜來自加速規，左右轉頭來自陀螺儀。轉頭角度會慢慢回正，避免累積誤差。': ['Follows your head: tilting comes from the accelerometer, turning from the gyroscope. The turn slowly recentres to avoid drift.', '頭の動きに追従します。傾きは加速度計、左右の回転はジャイロから得ます。誤差の蓄積を防ぐため、回転はゆっくり中央に戻ります。'],
  '手動調整視角': ['Adjusting the view', '視点の手動調整'],
  '拖曳會繞著腦中央旋轉，滑鼠滾輪縮放。手機左半邊：左右繞行、上下縮放；「上／下」鍵改變俯仰。按「重設視角」回到後上方。': ['Drag to orbit the middle of the brain; use the wheel to zoom. On a phone, the left half orbits (sideways) and zooms (up/down); Up/Down buttons change elevation. “Reset view” returns to above and behind.', 'ドラッグで脳の中央を周回し、ホイールでズームします。スマホの左半分は左右で周回、上下でズーム、「上／下」ボタンで高さを変えます。「視点リセット」で後ろ上方に戻ります。'],
  '標籤文字': ['Labels', 'ラベル'],
  '顯示該感測點目前相對最強的頻段，「平穩」表示沒有明顯偏強。': ['Show the relatively strongest band at that sensor. “Steady” means none stands out.', 'そのセンサーで相対的に最も強い帯域を示します。「安定」は目立つ帯域がないことを示します。'],
  '限制': ['Limits', '制限'],
  '頭皮腦波訊號會擴散，只能說是「感測點附近」的活動，無法定位到某個深部腦區。': ['Scalp EEG spreads, so this shows activity near a sensor. It cannot locate a specific deep brain region.', '頭皮脳波は広がるため、「センサー付近」の活動としか言えず、特定の深部領域は特定できません。'],
  '模型來源': ['Model credit', 'モデルの出典'],
  'Detailed Human Brain Model，Johnson J，NIH 3D（3DPX-021161），CC BY 4.0。為了網頁載入已簡化面數。': ['Detailed Human Brain Model by Johnson J, NIH 3D (3DPX-021161), CC BY 4.0. Simplified for web loading.', 'Detailed Human Brain Model、Johnson J、NIH 3D（3DPX-021161）、CC BY 4.0。Web 用にポリゴン数を削減しています。'],
  '不同狀態通常的樣子': ['What different states usually look like', '状態ごとの一般的な見え方'],
  '狀態對照': ['State comparison', '状態の比較'],
  '狀態': ['State', '状態'],
  '腦波傾向': ['EEG tendency', '脳波の傾向'],
  'α 上升，β 下降': ['α up, β down', 'α 上昇、β 低下'],
  '中段變亮，旋臂收窄、線條乾淨': ['Middle brightens; arms narrow and clean', '中間が明るく、腕は細く整う'],
  '前額 θ、低頻 β 上升，α 下降': ['Frontal θ and low β up, α down', '前頭部の θ と低周波 β が上昇、α 低下'],
  '光往中心聚攏，外圍變淡': ['Light gathers inward; edge fades', '光が中心に集まり、外側は淡くなる'],
  '放空、走神': ['Wandering', 'ぼんやり・上の空'],
  'δ、θ 上升，α、β 下降，較不穩定': ['δ and θ up, α and β down, less steady', 'δ・θ 上昇、α・β 低下、やや不安定'],
  '外圍變亮、旋臂發散': ['Edge brightens; arms scatter', '外側が明るく、腕が広がる'],
  '焦躁、想不停': ['Anxious, racing thoughts', '焦り・考えが止まらない'],
  '高頻 β 上升，訊號不穩定': ['High β up, unsteady signal', '高周波 β 上昇、信号が不安定'],
  '內側細碎閃爍、旋臂發散': ['Inner flicker; arms scatter', '内側がきらめき、腕が広がる'],
  '這是常見傾向，每個人差異很大。沒有單一波段能代表「亂想」，銀河也不會判斷您在想什麼。想看出自己的變化，建議多次記錄後比較。': ['These are common tendencies and vary widely between people. No single band means “mind wandering”, and the galaxy cannot tell what you are thinking. To see your own patterns, record several sessions and compare.', 'これは一般的な傾向で、個人差が大きいものです。「雑念」を示す単一の帯域はなく、銀河があなたの考えを判断することもありません。自分の変化を見るには、複数回記録して比較してください。'],
  '畫面突然變化，可能不是腦波': ['Sudden changes may not be brainwaves', '急な変化は脳波ではないかもしれません'],
  '咬牙、皺眉': ['Clenching or frowning', '歯の食いしばり・しかめ面'],
  '肌肉訊號會讓內側的高頻區變亮、閃爍。放鬆下顎通常就會恢復。': ['Muscle signals brighten and flicker the inner high-frequency area. Relaxing your jaw usually clears it.', '筋肉の信号で内側の高周波域が明るくきらめきます。あごをゆるめると通常は戻ります。'],
  '眨眼、轉動眼球': ['Blinking or eye movement', 'まばたき・眼球の動き'],
  '會影響前額的低頻。偵測到大幅雜訊時，該旋臂會暫時淡化。': ['Affects frontal low frequencies. When large noise is detected, that arm fades briefly.', '前頭部の低周波に影響します。大きなノイズを検出すると、その腕は一時的に薄くなります。'],
  '想睡': ['Drowsiness', '眠気'],
  'θ 上升、α 下降，看起來可能和放空很像。': ['θ up and α down; it can look like wandering.', 'θ 上昇、α 低下で、ぼんやりした状態と似て見えることがあります。'],
  '心跳不跳動': ['No heartbeat pulse', '心拍が動かない'],
  '頭帶沒貼緊額頭時，PPG 可能測不到心跳，中心就不會脈動。': ['If the headband is not snug on the forehead, PPG may miss your heartbeat and the centre will not pulse.', 'ヘッドバンドが額に密着していないと PPG で心拍を測れず、中心は脈打ちません。'],
  '操作方式': ['Controls', '操作方法'],
  '手機左半邊移動、右半邊轉向。電腦用 WASD、Q／E 升降，滑鼠轉向，M 標記、空白鍵暫停、R 重設。': ['Phone: left half moves, right half turns. Computer: WASD to move, Q/E up and down, mouse to turn, M to mark, Space to pause, R to reset.', 'スマホは左半分で移動、右半分で向きを変えます。PC は WASD で移動、Q／E で昇降、マウスで視点、M でマーク、スペースで一時停止、R でリセット。'],
  '眼鏡先切 3D 模式。手機左半邊移動、右半邊轉向；雙擊暫停、兩指標記、三指連按兩次結束。': ['Switch the glasses to 3D mode first. Left half of the phone moves, right half turns. Double-tap pauses, two fingers mark, three fingers twice ends.', '先にグラスを 3D モードにします。スマホの左半分で移動、右半分で向きを変えます。ダブルタップで一時停止、2本指でマーク、3本指を2回で終了。'],
  '左搖桿移動，右搖桿升降與轉向，A 標記、握把暫停、B 重設視角。': ['Left stick moves; right stick raises, lowers and turns. A marks, grip pauses, B resets the view.', '左スティックで移動、右スティックで昇降と回転。A でマーク、グリップで一時停止、B で視点リセット。'],
  '本次結果': ['Session results', '今回の結果'],
  '匯出 ZIP': ['Export ZIP', 'ZIP を書き出す'],
  '分享到…': ['Share…', '共有…'],
  '怎麼解讀': ['How to read this', '読み方'],
  '回首頁': ['Home', 'ホームへ'],
  '資料存在此瀏覽器，清除瀏覽器資料會一併刪除，請記得匯出。「呼吸」欄位是引導節奏，不是實測呼吸。': ['Data is stored in this browser and is erased if you clear browser data, so remember to export. Breathing fields are the guided rhythm, not measured breathing.', 'データはこのブラウザに保存され、ブラウザのデータを消去すると削除されます。書き出しをお忘れなく。呼吸の項目はガイドのリズムで、実測値ではありません。'],
  '本機資料': ['Local data', '端末内のデータ'],
  '批次匯出 summary.csv': ['Export summary.csv', 'summary.csv を一括書き出し'],
  // Messages set from code
  '可用': ['Available', '利用可'],
  '不可用': ['Unavailable', '利用不可'],
  '藍牙': ['Bluetooth', 'Bluetooth'],
  '安全連線': ['Secure context', '安全な接続'],
  '此瀏覽器無法直接連 Muse。請用 Android／電腦 Chrome，或以手機轉傳到 Quest。': ['This browser cannot connect to Muse directly. Use Chrome on Android or a computer, or relay from a phone to Quest.', 'このブラウザは Muse に直接接続できません。Android／PC の Chrome を使うか、スマホから Quest へ転送してください。'],
  'Muse 連線中斷，正在重新連線…': ['Muse disconnected. Reconnecting…', 'Muse の接続が切れました。再接続しています…'],
  '已重新連線': ['Reconnected', '再接続しました'],
  '無法重新連線。已記錄的資料都還在，可按「結束」後匯出。': ['Could not reconnect. Recorded data is safe; press End to export it.', '再接続できませんでした。記録済みのデータは保持されています。「終了」後に書き出せます。'],
  '請在視窗中選擇您的 Muse…': ['Choose your Muse in the window…', 'ウィンドウで Muse を選択してください…'],
  '未選擇裝置。請確認 Muse 已開機，且官方 App 已斷線。': ['No device chosen. Make sure Muse is on and disconnected from the official app.', 'デバイスが選択されていません。Muse の電源が入っており、公式アプリから切断されていることを確認してください。'],
  '連線失敗：{0}': ['Connection failed: {0}', '接続に失敗しました：{0}'],
  '單指：左半邊移動、右半邊轉視角。電腦用 WASD 與滑鼠。': ['One finger: left half moves, right half turns. On a computer use WASD and the mouse.', '指1本：左半分で移動、右半分で視点を変更。PC は WASD とマウス。'],
  '請先把眼鏡切到 3D 模式。手機畫面不顯示按鈕：左半移動、右半轉向；雙擊暫停、兩指標記、三指連按兩次結束。': ['Switch the glasses to 3D mode first. No buttons appear on the phone: left half moves, right half turns; double-tap pauses, two fingers mark, three fingers twice ends.', '先にグラスを 3D モードにしてください。スマホにボタンは表示されません。左半分で移動、右半分で向きを変更、ダブルタップで一時停止、2本指でマーク、3本指を2回で終了。'],
  '左搖桿漂浮移動；右搖桿上下與轉向；A 標記、握把暫停、B 重設。': ['Left stick floats; right stick raises, lowers and turns; A marks, grip pauses, B resets.', '左スティックで移動、右スティックで昇降と回転。A でマーク、グリップで一時停止、B でリセット。'],
  '此裝置沒有 VR。校準後會顯示代碼，讓 Quest 接收這台手機的資料；紀錄存在這台手機。': ['This device has no VR. A code will appear after calibration so Quest can receive this phone’s data; the recording stays on this phone.', 'この端末に VR はありません。キャリブレーション後にコードが表示され、Quest がこのスマホのデータを受信します。記録はこのスマホに保存されます。'],
  '無法開啟本機儲存，這次不會記錄：{0}': ['Local storage unavailable, so this session will not be recorded: {0}', 'ローカル保存を開けないため、今回は記録されません：{0}'],
  '良好': ['Good', '良好'],
  '普通': ['Fair', '普通'],
  '不佳': ['Poor', '不良'],
  '乾淨訊號偏少，基準可能不準。建議調整頭帶後重新開始。': ['Little clean signal, so the baseline may be unreliable. Adjust the headband and start again.', 'きれいな信号が少なく、基準が不正確な可能性があります。ヘッドバンドを調整してやり直してください。'],
  'Quest 已連線，請在 Quest 按「進入 VR」': ['Quest connected. Press “Enter VR” on Quest.', 'Quest に接続しました。Quest で「VR に入る」を押してください。'],
  'Quest 已離線': ['Quest disconnected', 'Quest が切断されました'],
  'Quest 已離線，記錄仍在繼續': ['Quest disconnected; recording continues', 'Quest が切断されましたが、記録は続いています'],
  '轉傳錯誤：{0}': ['Relay error: {0}', '転送エラー：{0}'],
  '無法進入 VR：{0}': ['Could not enter VR: {0}', 'VR に入れません：{0}'],
  '已標記': ['Marked', 'マークしました'],
  '部分資料寫入失敗：{0}': ['Some data could not be saved: {0}', '一部のデータを保存できませんでした：{0}'],
  '模擬資料。切換狀態後約 10 秒會逐漸變化。': ['Simulated data. Changes appear gradually about 10 seconds after switching.', 'シミュレーションです。切り替えて約10秒で徐々に変化します。'],
  '放鬆：旋臂中段變亮，線條收窄、乾淨。': ['Relax: the middle of the arms brightens; lines narrow and clean.', 'リラックス：腕の中間が明るくなり、線は細く整います。'],
  '專注：光往中心聚攏，外圍變淡。': ['Focus: light gathers inward; the edge fades.', '集中：光が中心に集まり、外側は淡くなります。'],
  '放空：外圍變亮，旋臂發散、不規則。': ['Wander: the edge brightens; arms scatter irregularly.', 'ぼんやり：外側が明るくなり、腕は不規則に広がります。'],
  '焦躁：內側細碎閃爍，旋臂發散。': ['Anxious: the inner area flickers; arms scatter.', '焦り：内側がきらめき、腕が広がります。'],
  '請輸入 6 位數代碼': ['Enter the 6-digit code', '6桁のコードを入力してください'],
  '連線中…': ['Connecting…', '接続中…'],
  '已連線，等待手機設定…': ['Connected. Waiting for the phone…', '接続しました。スマホを待っています…'],
  '手機已離線': ['Phone disconnected', 'スマホが切断されました'],
  '找不到這組代碼': ['Code not found', 'このコードは見つかりません'],
  '連線錯誤：{0}': ['Connection error: {0}', '接続エラー：{0}'],
  '準備完成': ['Ready', '準備完了'],
  '本次結束，資料已存在手機上。': ['Session ended. The data is on your phone.', '終了しました。データはスマホに保存されています。'],
  '未填代號': ['No code', 'コードなし'],
  '{0}，相對靜息基準（SD）': ['{0}, relative to resting baseline (SD)', '{0}、安静時基準との差（SD）'],
  '平均心率': ['Mean heart rate', '平均心拍数'],
  '訓練分鐘': ['Minutes', 'トレーニング時間（分）'],
  '雜訊比例': ['Noise', 'ノイズ率'],
  'EEG 完整度': ['EEG completeness', 'EEG 完全性'],
  '心率': ['Heart rate', '心拍数'],
  '資料不足': ['Not enough data', 'データ不足'],
  '{0} 趨勢': ['{0} trend', '{0} の推移'],
  '正在打包…': ['Packing…', '作成中…'],
  '已取消分享': ['Share cancelled', '共有をキャンセルしました'],
  '已匯出 {0}（{1} MB）': ['Exported {0} ({1} MB)', '{0} を書き出しました（{1} MB）'],
  '匯出失敗：{0}': ['Export failed: {0}', '書き出しに失敗しました：{0}'],
  '這次未能使用本機儲存，沒有可匯出的資料。': ['Local storage was unavailable, so there is nothing to export.', 'ローカル保存を利用できなかったため、書き出すデータはありません。'],
  '無法讀取紀錄：{0}': ['Could not read history: {0}', '履歴を読み込めません：{0}'],
  '還沒有紀錄。': ['No sessions yet.', 'まだ記録がありません。'],
  '{0} 分': ['{0} min', '{0} 分'],
  '未完成': ['Incomplete', '未完了'],
  '查看': ['View', '表示'],
  '匯出': ['Export', '書き出し'],
  '刪除': ['Delete', '削除'],
  '確定刪除？': ['Delete?', '削除しますか？'],
  '已匯出 summary.csv': ['Exported summary.csv', 'summary.csv を書き出しました'],
  '連線失敗（{0}）：{1}': ['Connection failed ({0}): {1}', '接続に失敗しました（{0}）：{1}'],
  '已連線，但這些感測器無法使用：{0}': ['Connected, but these sensors are unavailable: {0}', '接続しましたが、次のセンサーは使えません：{0}'],
  '最常出現的狀態': ['Most frequent state', '最も多かった状態'],
  '放鬆傾向': ['Relaxed', 'リラックス傾向'],
  '專注傾向': ['Focused', '集中傾向'],
  '放空傾向': ['Drifting', 'ぼんやり傾向'],
  '緊繃傾向': ['Tense', '緊張傾向'],
  '訊號不穩': ['Unsteady signal', '信号が不安定'],
  '各頻段接近您的靜息基準。': ['Bands are close to your resting baseline.', '各帯域が安静時の基準に近い状態です。'],
  'α 相對上升、β 下降，常見於放鬆或閉眼休息。': ['α up and β down, common when relaxed or resting with eyes closed.', 'α が上がり β が下がっています。リラックスや閉眼時によく見られます。'],
  '參與度指數 β/(α+θ) 上升，訊號穩定。': ['Engagement index β/(α+θ) is up with a steady signal.', 'エンゲージメント指数 β/(α+θ) が上がり、信号は安定しています。'],
  'θ/β 比值上升、訊號較不穩定，可能是走神或想睡。': ['θ/β ratio is up and the signal is less steady; possibly mind wandering or drowsiness.', 'θ/β 比が上がり信号がやや不安定です。上の空か眠気の可能性があります。'],
  '高頻 β 偏高且不穩定。可能是焦躁，也可能只是咬牙或皺眉。': ['High β is elevated and unsteady. It may be tension, or just clenching or frowning.', '高周波 β が高く不安定です。焦りの可能性も、単に歯の食いしばりやしかめ面の可能性もあります。'],
  '雜訊太多，請放鬆下顎、調整頭帶。': ['Too much noise. Relax your jaw and adjust the headband.', 'ノイズが多すぎます。あごをゆるめ、ヘッドバンドを調整してください。'],
  '「目前狀態」怎麼判斷': ['How the current state is estimated', '「現在の状態」の判定方法'],
  '比較基準': ['Baseline', '比較の基準'],
  '每個指標都和您校準時的靜息狀態比較，並在約 2 秒內平滑，至少持續 3 秒才換狀態。': ['Every marker is compared with your resting calibration, smoothed over about 2 seconds, and a state must last 3 seconds before it changes.', 'すべての指標はキャリブレーション時の安静状態と比較し、約2秒で平滑化します。状態が切り替わるには3秒以上続く必要があります。'],
  'α 相對上升、β 下降。α 增加是放鬆與閉眼休息最常見的變化。': ['α up and β down. Rising α is the most common change with relaxation and eyes-closed rest.', 'α が上がり β が下がります。α の増加はリラックスや閉眼安静で最もよく見られる変化です。'],
  '參與度指數 β/(α+θ) 上升（Pope 等人提出，用於持續注意力研究），加上前額 θ 上升、訊號穩定。': ['The engagement index β/(α+θ) rises (proposed by Pope et al. and used in sustained-attention research), with frontal θ up and a steady signal.', 'エンゲージメント指数 β/(α+θ)（Pope らが提案し、持続的注意の研究で使用）が上がり、前頭部の θ も上昇し、信号が安定しています。'],
  'θ/β 比值上升且訊號較不穩定。研究發現走神時 θ 增加、β 減少；想睡時 θ 也會上升。': ['θ/β ratio up with a less steady signal. Studies find more θ and less β during mind wandering; θ also rises with drowsiness.', 'θ/β 比が上がり信号がやや不安定です。研究では上の空のとき θ が増え β が減り、眠いときも θ が上がります。'],
  '高頻 β（20–30 Hz）偏高且訊號不穩定。這一項的研究證據最弱，咬牙、皺眉的肌肉訊號也會造成相同結果。': ['High β (20–30 Hz) is elevated and unsteady. This has the weakest evidence, and muscle signals from clenching or frowning look the same.', '高周波 β（20〜30 Hz）が高く不安定です。この項目は研究上の根拠が最も弱く、歯の食いしばりやしかめ面でも同じ結果になります。'],
  '注意': ['Please note', '注意'],
  '這些是傾向，不是診斷，也無法知道您在想什麼。Muse 只有四個乾電極，個人差異也很大，建議多次記錄後與自己比較。': ['These are tendencies, not a diagnosis, and they cannot tell what you are thinking. Muse has only four dry electrodes and people differ widely, so record several sessions and compare with yourself.', 'これは傾向であり診断ではなく、考えている内容もわかりません。Muse は乾式電極が4つだけで個人差も大きいため、複数回記録して自分自身と比較してください。'],
  '模擬資料': ['Simulated data', 'シミュレーション'],
  '平穩': ['Steady', '安定'],
  '{0} 偏強': ['{0} strong', '{0} 強め'],
  '無法載入轉傳元件，請確認網路': ['Could not load the relay component. Check your network.', '転送コンポーネントを読み込めません。ネットワークを確認してください。'],
  '左耳後': ['behind left ear', '左耳の後ろ'],
  '右耳後': ['behind right ear', '右耳の後ろ'],
  '左前額': ['left forehead', '左の額'],
  '右前額': ['right forehead', '右の額'],
};

const INDEX = { zh: -1, en: 0, ja: 1 };
const HTML_LANG = { zh: 'zh-Hant', en: 'en', ja: 'ja' };
const reverse = new Map();
for (const [zh, values] of Object.entries(T)) for (const v of values) if (!reverse.has(v)) reverse.set(v, zh);

function readSaved() { try { return localStorage.getItem('bg-lang'); } catch { return null; } }
function detect() {
  const saved = readSaved();
  if (saved && saved in INDEX) return saved;
  const nav = (navigator.language || 'zh').toLowerCase();
  return nav.startsWith('ja') ? 'ja' : nav.startsWith('zh') ? 'zh' : 'en';
}

let lang = detect();
export const getLang = () => lang;
export const locale = () => HTML_LANG[lang];
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('bg-lang', l); } catch { /* keeps working for this visit */ }
}

export function tr(key, ...args) {
  let s = key;
  if (lang !== 'zh' && T[key]) s = T[key][INDEX[lang]];
  args.forEach((a, i) => { s = s.replace(`{${i}}`, () => a); });
  return s;
}

// Finds the source text of a node's current wording, whichever language it is in.
const sourceOf = (text) => (T[text] ? text : reverse.get(text));

function translateValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const zh = sourceOf(trimmed);
  return zh ? value.replace(trimmed, () => tr(zh)) : value;
}

export function applyLang(root = document.body) {
  document.documentElement.lang = HTML_LANG[lang];
  document.title = lang === 'zh' ? '星息 Breath Galaxy' : tr('星息');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (['SCRIPT', 'STYLE'].includes(n.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const next = translateValue(n.nodeValue);
    if (next !== n.nodeValue) n.nodeValue = next;
  }
  root.querySelectorAll('[aria-label],[placeholder]').forEach((el) => {
    for (const attr of ['aria-label', 'placeholder']) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, translateValue(el.getAttribute(attr)));
    }
  });
  document.querySelectorAll('.lang-bar button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

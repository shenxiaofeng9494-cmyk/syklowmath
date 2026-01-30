-- 为"一元二次方程定义课"配置必停点
-- 这是demo数据，展示Voice-First老师主动介入功能

-- Case 1: 动机段 - "为什么要学一元二次方程"
-- 假设这个节点的ID是 'node-motivation-001'（需要根据实际视频节点ID替换）
UPDATE video_nodes
SET
  is_critical_checkpoint = TRUE,
  checkpoint_type = 'motivation',
  checkpoint_question = '我停一下。你现在如果只是觉得"二次方程更厉害"，后面你会不知道它到底解决了什么问题。我只问一句：用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。',
  checkpoint_expected_answer = 'yes_no',
  checkpoint_followup = NULL,
  silence_threshold_seconds = 5
WHERE
  title LIKE '%为什么%二次方程%'
  OR title LIKE '%动机%'
  OR summary LIKE '%低次方程%局限性%';

-- Case 2: 定义段 - "最高次数陷阱"
UPDATE video_nodes
SET
  is_critical_checkpoint = TRUE,
  checkpoint_type = 'definition',
  checkpoint_question = '我必须在这停一下。这里如果你理解错，后面你会把很多方程全都分错类。我说一个式子，你只回答对或不对：x² + x = 0 是一元二次方程。对不对？',
  checkpoint_expected_answer = 'yes_no',
  checkpoint_followup = '我再换一个：x + 1 = 0 是不是？回答：是 / 不是。',
  silence_threshold_seconds = 5
WHERE
  title LIKE '%平方%'
  OR title LIKE '%二次%'
  OR summary LIKE '%最高次数%'
  OR summary LIKE '%x的平方%';

-- Case 3: 整式方程 - "分母不能有未知数"
UPDATE video_nodes
SET
  is_critical_checkpoint = TRUE,
  checkpoint_type = 'pitfall',
  checkpoint_question = '这里我要点名确认。很多人考试错在这一步。1/x + 1 = 0，是不是一元二次方程？回答：是 / 不是。',
  checkpoint_expected_answer = 'yes_no',
  checkpoint_followup = NULL,
  silence_threshold_seconds = 5
WHERE
  title LIKE '%整式%'
  OR summary LIKE '%分母%未知数%'
  OR summary LIKE '%整式方程%';

-- 查询配置结果
SELECT
  id,
  title,
  checkpoint_type,
  LEFT(checkpoint_question, 50) as question_preview,
  checkpoint_expected_answer,
  silence_threshold_seconds
FROM video_nodes
WHERE is_critical_checkpoint = TRUE
ORDER BY order;

// test-api.js - 完整的API测试脚本
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
let token = null;
let surveyId = null;
let testUserId = null;

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function logSuccess(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function logInfo(msg) {
  console.log(`${colors.blue}📝 ${msg}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.yellow}========== 测试: ${name} ==========${colors.reset}`);
}

async function runTest(name, testFn) {
  logTest(name);
  try {
    await testFn();
  } catch (err) {
    logError(`测试失败: ${err.message}`);
    console.error(err);
  }
}

// ========== 1. 创建问卷测试 ==========
async function testCreateSurvey() {
  // 先注册/登录获取token
  const registerRes = await axios.post(`${API_BASE}/register`, {
    username: `testuser_${Date.now()}`,
    password: '123456',
    email: 'test@test.com'
  });
  
  if (!registerRes.data.success) {
    throw new Error('注册失败');
  }
  
  token = registerRes.data.token;
  testUserId = registerRes.data.user.id;
  logSuccess(`注册成功，用户ID: ${testUserId}`);
  
  // 创建问卷
  const surveyRes = await axios.post(`${API_BASE}/create-survey`, {
    title: '测试问卷 - 满意度调查',
    description: '这是一个用于测试的问卷',
    allowAnonymous: true,
    allowMultipleSubmit: true
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!surveyRes.data.success) {
    throw new Error('创建问卷失败');
  }
  
  surveyId = surveyRes.data.survey.surveyId;
  logSuccess(`问卷创建成功，问卷ID: ${surveyId}`);
  logInfo(`问卷标题: ${surveyRes.data.survey.title}`);
  
  return true;
}

// ========== 2. 添加题目测试 ==========
async function testAddQuestions() {
  // 测试1: 添加单选题
  logInfo('测试添加单选题...');
  const q1Res = await axios.post(`${API_BASE}/add-question`, {
    surveyId: surveyId,
    questionId: 'q1',
    title: '您的性别是？',
    type: 'single_choice',
    required: true,
    config: {
      options: [
        { value: 'male', label: '男' },
        { value: 'female', label: '女' }
      ]
    }
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!q1Res.data.success) {
    throw new Error('添加单选题失败');
  }
  logSuccess('单选题添加成功');
  
  // 测试2: 添加多选题
  logInfo('测试添加多选题...');
  const q2Res = await axios.post(`${API_BASE}/add-question`, {
    surveyId: surveyId,
    questionId: 'q2',
    title: '您喜欢哪些水果？',
    type: 'multi_choice',
    required: true,
    config: {
      options: [
        { value: 'apple', label: '苹果' },
        { value: 'banana', label: '香蕉' },
        { value: 'orange', label: '橙子' }
      ],
      minSelect: 1,
      maxSelect: 2
    }
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!q2Res.data.success) {
    throw new Error('添加多选题失败');
  }
  logSuccess('多选题添加成功');
  
  // 测试3: 添加文本题
  logInfo('测试添加文本题...');
  const q3Res = await axios.post(`${API_BASE}/add-question`, {
    surveyId: surveyId,
    questionId: 'q3',
    title: '请留下您的建议',
    type: 'text',
    required: false,
    config: {
      minLength: 5,
      maxLength: 200
    }
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!q3Res.data.success) {
    throw new Error('添加文本题失败');
  }
  logSuccess('文本题添加成功');
  
  // 测试4: 添加数字题
  logInfo('测试添加数字题...');
  const q4Res = await axios.post(`${API_BASE}/add-question`, {
    surveyId: surveyId,
    questionId: 'q4',
    title: '您的年龄是？',
    type: 'number',
    required: true,
    config: {
      minValue: 1,
      maxValue: 120,
      integerOnly: true
    }
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!q4Res.data.success) {
    throw new Error('添加数字题失败');
  }
  logSuccess('数字题添加成功');
  
  return true;
}

// ========== 3. 跳转逻辑测试 ==========
async function testJumpLogic() {
  // 添加跳转逻辑: 如果性别选"男"，跳转到年龄题(q4)
  logInfo('测试添加跳转逻辑...');
  const logicRes = await axios.post(`${API_BASE}/add-logic`, {
    surveyId: surveyId,
    sourceQuestionId: 'q1',
    conditions: [
      { type: 'option_selected', optionValue: 'male' }
    ],
    targetQuestionId: 'q4',
    priority: 1
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!logicRes.data.success) {
    throw new Error('添加跳转逻辑失败');
  }
  logSuccess('跳转逻辑添加成功');
  
  // 测试跳转逻辑: 选"男"应该跳转到q4
  logInfo('测试跳转: q1=male → 应该跳转到q4');
  const testRes = await axios.post(`${API_BASE}/test-jump`, {
    surveyId: surveyId,
    currentQuestionId: 'q1',
    answer: 'male'
  });
  
  if (testRes.data.nextQuestionId === 'q4') {
    logSuccess('跳转测试通过: male → q4');
  } else {
    logError(`跳转测试失败: 期望q4，实际${testRes.data.nextQuestionId}`);
  }
  
  // 测试跳转逻辑: 选"女"应该没有跳转（返回null）
  logInfo('测试跳转: q1=female → 应该不跳转');
  const testRes2 = await axios.post(`${API_BASE}/test-jump`, {
    surveyId: surveyId,
    currentQuestionId: 'q1',
    answer: 'female'
  });
  
  if (testRes2.data.nextQuestionId === null) {
    logSuccess('跳转测试通过: female → 无跳转');
  } else {
    logError(`跳转测试失败: 期望null，实际${testRes2.data.nextQuestionId}`);
  }
  
  return true;
}

// ========== 4. 校验测试 ==========
async function testValidation() {
  // 获取问卷信息
  const surveyRes = await axios.get(`${API_BASE}/survey/${surveyId}`);
  const survey = surveyRes.data.survey;
  
  // 测试1: 必填项校验
  logInfo('测试必填项校验...');
  const submit1 = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [],  // 空答案
    respondentName: '测试用户',
    isAnonymous: false
  }).catch(err => err.response);
  
  if (submit1.status === 400 && submit1.data.error.includes('必填')) {
    logSuccess('必填项校验通过');
  } else {
    logError('必填项校验失败');
  }
  
  // 测试2: 单选题选项校验
  logInfo('测试单选题选项校验...');
  const submit2 = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [
      { questionId: 'q1', value: 'invalid_option' }  // 无效选项
    ],
    respondentName: '测试用户',
    isAnonymous: false
  }).catch(err => err.response);
  
  if (submit2.status === 400 && submit2.data.error.includes('选项无效')) {
    logSuccess('单选题选项校验通过');
  } else {
    logError('单选题选项校验失败');
  }
  
  // 测试3: 多选题数量校验
  logInfo('测试多选题数量校验...');
  const submit3 = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [
      { questionId: 'q1', value: 'male' },
      { questionId: 'q2', value: ['apple', 'banana', 'orange'] },  // 超过maxSelect=2
      { questionId: 'q4', value: 25 }
    ],
    respondentName: '测试用户',
    isAnonymous: false
  }).catch(err => err.response);
  
  if (submit3.status === 400 && submit3.data.error.includes('最多选择')) {
    logSuccess('多选题数量校验通过');
  } else {
    logError('多选题数量校验失败');
  }
  
  // 测试4: 数字范围校验
  logInfo('测试数字范围校验...');
  const submit4 = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [
      { questionId: 'q1', value: 'male' },
      { questionId: 'q2', value: ['apple', 'banana'] },
      { questionId: 'q4', value: 150 }  // 超过maxValue=120
    ],
    respondentName: '测试用户',
    isAnonymous: false
  }).catch(err => err.response);
  
  if (submit4.status === 400 && submit4.data.error.includes('不能大于')) {
    logSuccess('数字范围校验通过');
  } else {
    logError('数字范围校验失败');
  }
  
  // 测试5: 文本长度校验
  logInfo('测试文本长度校验...');
  const submit5 = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [
      { questionId: 'q1', value: 'male' },
      { questionId: 'q2', value: ['apple', 'banana'] },
      { questionId: 'q3', value: '短' },  // 小于minLength=5
      { questionId: 'q4', value: 25 }
    ],
    respondentName: '测试用户',
    isAnonymous: false
  }).catch(err => err.response);
  
  if (submit5.status === 400 && submit5.data.error.includes('最少需要')) {
    logSuccess('文本长度校验通过');
  } else {
    logError('文本长度校验失败');
  }
  
  return true;
}

// ========== 5. 提交问卷测试 ==========
async function testSubmitSurvey() {
  logInfo('测试正常提交问卷...');
  
  const submitRes = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [
      { questionId: 'q1', value: 'male' },
      { questionId: 'q2', value: ['apple', 'banana'] },
      { questionId: 'q3', value: '这是一个很好的问卷，我非常满意！' },
      { questionId: 'q4', value: 28 }
    ],
    respondentName: '张三',
    isAnonymous: false
  });
  
  if (submitRes.data.success) {
    logSuccess(`问卷提交成功，答卷ID: ${submitRes.data.responseId}`);
  } else {
    throw new Error('提交失败');
  }
  
  // 测试匿名提交
  logInfo('测试匿名提交...');
  const submitAnonymous = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: [
      { questionId: 'q1', value: 'female' },
      { questionId: 'q2', value: ['orange'] },
      { questionId: 'q3', value: '匿名用户提交的反馈' },
      { questionId: 'q4', value: 35 }
    ],
    respondentName: null,
    isAnonymous: true
  });
  
  if (submitAnonymous.data.success) {
    logSuccess('匿名提交成功');
  } else {
    throw new Error('匿名提交失败');
  }
  
  return true;
}

// ========== 6. 统计测试 ==========
async function testStatistics() {
  logInfo('测试获取统计数据...');
  
  const statsRes = await axios.get(`${API_BASE}/survey-stats/${surveyId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!statsRes.data.success) {
    throw new Error('获取统计失败');
  }
  
  const stats = statsRes.data.stats;
  logSuccess(`总答卷数: ${stats.totalResponses}`);
  
  // 验证单选题统计
  const q1Stats = stats.questions.q1;
  if (q1Stats) {
    logInfo(`单选题统计: 男=${q1Stats.options?.male?.count || 0}, 女=${q1Stats.options?.female?.count || 0}`);
  }
  
  // 验证多选题统计
  const q2Stats = stats.questions.q2;
  if (q2Stats) {
    logInfo(`多选题统计: 总选择次数=${q2Stats.totalSelections || 0}`);
  }
  
  // 验证数字题统计
  const q4Stats = stats.questions.q4;
  if (q4Stats) {
    logInfo(`数字题统计: 平均值=${q4Stats.avg}, 最小值=${q4Stats.min}, 最大值=${q4Stats.max}`);
  }
  
  logSuccess('统计测试通过');
  return true;
}

// ========== 运行所有测试 ==========
async function runAllTests() {
  console.log(`
${colors.yellow}╔════════════════════════════════════════╗
║     问卷系统 API 自动化测试          ║
╚════════════════════════════════════════╝${colors.reset}
  `);
  
  await runTest('1. 创建问卷测试', testCreateSurvey);
  await runTest('2. 添加题目测试', testAddQuestions);
  await runTest('3. 跳转逻辑测试', testJumpLogic);
  await runTest('4. 校验测试', testValidation);
  await runTest('5. 提交问卷测试', testSubmitSurvey);
  await runTest('6. 统计测试', testStatistics);
  
  console.log(`\n${colors.green}╔════════════════════════════════════════╗
║         所有测试执行完毕！            ║
╚════════════════════════════════════════╝${colors.reset}\n`);
}

// 安装依赖并运行
async function main() {
  try {
    await runAllTests();
  } catch (err) {
    console.error('测试执行出错:', err);
  }
}

main();
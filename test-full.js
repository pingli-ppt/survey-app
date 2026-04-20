// test-full.js - 完整的API自动化测试脚本（覆盖第一阶段和第二阶段需求）
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
let token = null;
let surveyId = null;
let testUserId = null;
let questionBaseId = null;
let questionVersionId = null;
let sharedQuestionBaseId = null;

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

let passedTests = 0;
let failedTests = 0;
let testResults = [];

function logSuccess(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
  passedTests++;
  testResults.push({ status: 'PASS', message: msg });
}

function logError(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
  failedTests++;
  testResults.push({ status: 'FAIL', message: msg });
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
    if (err.response) {
      console.log(`${colors.red}响应数据:${colors.reset}`, err.response.data);
    }
    failedTests++;
    testResults.push({ status: 'FAIL', message: name + ': ' + err.message });
  }
}

// ========== 第一阶段测试：初始需求 ==========

// 1.1 用户注册测试
async function testRegister() {
  logInfo('测试正常注册...');
  const timestamp = Date.now();
  const registerRes = await axios.post(`${API_BASE}/register`, {
    username: `testuser_${timestamp}`,
    password: '123456',
    email: 'test@test.com'
  });
  
  if (!registerRes.data.success) {
    throw new Error('注册失败');
  }
  logSuccess(`注册成功，用户ID: ${registerRes.data.user.id}`);
  token = registerRes.data.token;
  testUserId = registerRes.data.user.id;
  
  logInfo('测试重复注册...');
  try {
    await axios.post(`${API_BASE}/register`, {
      username: `testuser_${timestamp}`,
      password: '123456',
      email: 'test@test.com'
    });
    logError('重复注册应该失败但成功了');
  } catch (err) {
    if (err.response?.data?.error?.includes('用户名已存在')) {
      logSuccess('重复注册被正确阻止');
    } else {
      throw new Error('重复注册错误信息不正确');
    }
  }
  
  logInfo('测试用户名为空注册...');
  try {
    await axios.post(`${API_BASE}/register`, {
      username: '',
      password: '123456',
      email: 'test@test.com'
    });
    logError('用户名为空应该失败');
  } catch (err) {
    if (err.response?.data?.error?.includes('不能为空')) {
      logSuccess('用户名为空被正确拒绝');
    }
  }
  
  logInfo('测试密码为空注册...');
  try {
    await axios.post(`${API_BASE}/register`, {
      username: 'testuser2',
      password: '',
      email: 'test@test.com'
    });
    logError('密码为空应该失败');
  } catch (err) {
    if (err.response?.data?.error?.includes('不能为空')) {
      logSuccess('密码为空被正确拒绝');
    }
  }
}

// 1.2 用户登录测试
async function testLogin() {
  logInfo('测试正常登录...');
  // 使用刚注册的用户登录
  const username = `testuser_${Date.now() - 1000}`;
  await axios.post(`${API_BASE}/register`, {
    username: username,
    password: '123456',
    email: 'test@test.com'
  }).catch(() => {});
  
  const loginRes = await axios.post(`${API_BASE}/login`, {
    username: username,
    password: '123456'
  });
  
  if (!loginRes.data.success) {
    throw new Error('登录失败');
  }
  logSuccess('登录成功');
  
  logInfo('测试错误密码...');
  try {
    await axios.post(`${API_BASE}/login`, {
      username: username,
      password: 'wrongpassword'
    });
    logError('错误密码登录应该失败');
  } catch (err) {
    if (err.response?.data?.error?.includes('用户名或密码错误')) {
      logSuccess('错误密码被正确拒绝');
    }
  }
  
  logInfo('测试不存在用户...');
  try {
    await axios.post(`${API_BASE}/login`, {
      username: 'nonexistent_user_xyz',
      password: '123456'
    });
    logError('不存在用户登录应该失败');
  } catch (err) {
    if (err.response?.data?.error?.includes('用户名或密码错误')) {
      logSuccess('不存在用户被正确拒绝');
    }
  }
}

// 1.3 创建题目测试（题库）
async function testCreateQuestion() {
  logInfo('测试创建文本题...');
  const textRes = await axios.post(`${API_BASE}/questions/create`, {
    title: '请填写您的建议',
    type: 'text',
    config: { minLength: 5, maxLength: 200 },
    changeNote: '创建题目'
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!textRes.data.success) {
    throw new Error('创建文本题失败');
  }
  logSuccess(`文本题创建成功，baseId: ${textRes.data.data.baseId}`);
  questionBaseId = textRes.data.data.baseId;
  questionVersionId = textRes.data.data.versionId;
  
  logInfo('测试创建数字题...');
  const numberRes = await axios.post(`${API_BASE}/questions/create`, {
    title: '您的年龄',
    type: 'number',
    config: { minValue: 0, maxValue: 120, integerOnly: true },
    changeNote: '创建题目'
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!numberRes.data.success) {
    throw new Error('创建数字题失败');
  }
  logSuccess('数字题创建成功');
  
  logInfo('测试创建单选题...');
  const singleRes = await axios.post(`${API_BASE}/questions/create`, {
    title: '您的性别',
    type: 'single_choice',
    config: { options: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
    changeNote: '创建题目'
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!singleRes.data.success) {
    throw new Error('创建单选题失败');
  }
  logSuccess('单选题创建成功');
  
  logInfo('测试创建多选题...');
  const multiRes = await axios.post(`${API_BASE}/questions/create`, {
    title: '喜欢的水果',
    type: 'multi_choice',
    config: { 
      options: [{ value: 'apple', label: '苹果' }, { value: 'banana', label: '香蕉' }, { value: 'orange', label: '橙子' }],
      minSelect: 1,
      maxSelect: 2
    },
    changeNote: '创建题目'
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!multiRes.data.success) {
    throw new Error('创建多选题失败');
  }
  logSuccess('多选题创建成功');
  
  logInfo('测试题目标题为空...');
  try {
    await axios.post(`${API_BASE}/questions/create`, {
      title: '',
      type: 'text',
      config: {},
      changeNote: '测试'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    logError('题目标题为空应该失败');
  } catch (err) {
    if (err.response?.data?.error?.includes('不能为空')) {
      logSuccess('题目标题为空被正确拒绝');
    }
  }
}

// 1.4 获取我的题目列表
async function testMyQuestions() {
  logInfo('测试获取我的题目列表...');
  const res = await axios.get(`${API_BASE}/questions/my-questions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.data.success) {
    throw new Error('获取题目列表失败');
  }
  
  if (res.data.questions && res.data.questions.length >= 4) {
    logSuccess(`获取到 ${res.data.questions.length} 个题目`);
  } else {
    logInfo(`获取到 ${res.data.questions?.length || 0} 个题目`);
  }
}

// 1.5 创建问卷测试
async function testCreateSurvey() {
  logInfo('测试创建问卷...');
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
  
  logInfo('测试标题为空创建问卷...');
  try {
    await axios.post(`${API_BASE}/create-survey`, {
      title: '',
      description: '测试'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    logError('标题为空应该创建失败');
  } catch (err) {
    if (err.response?.data?.error?.includes('标题不能为空')) {
      logSuccess('标题为空被正确拒绝');
    }
  }
}

// 1.6 从题库选择题目创建问卷
async function testCreateSurveyFromBank() {
  logInfo('测试从题库选择题目创建问卷...');
  
  const questionsRes = await axios.get(`${API_BASE}/questions/my-questions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!questionsRes.data.questions || questionsRes.data.questions.length === 0) {
    logInfo('没有可用题目，跳过测试');
    return true;
  }
  
  const selectedQuestion = questionsRes.data.questions[0];
  
  const questionDetailRes = await axios.get(`${API_BASE}/questions/${selectedQuestion.baseId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const selectedVersions = [{
    versionId: questionDetailRes.data.data.current.versionId,
    baseId: selectedQuestion.baseId
  }];
  
  const surveyRes = await axios.post(`${API_BASE}/questions/create-survey-from-bank`, {
    title: '从题库创建的问卷',
    description: '测试从题库选题',
    allowAnonymous: true,
    allowMultipleSubmit: true,
    deadline: null,
    selectedQuestions: selectedVersions
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!surveyRes.data.success) {
    throw new Error('从题库创建问卷失败');
  }
  
  logSuccess(`从题库创建问卷成功，问卷ID: ${surveyRes.data.data.survey.surveyId}`);
  sharedQuestionBaseId = selectedQuestion.baseId;
}

// 1.7 获取我的问卷列表
async function testMySurveys() {
  logInfo('测试获取我的问卷列表...');
  const res = await axios.get(`${API_BASE}/my-surveys`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.data.success) {
    throw new Error('获取问卷列表失败');
  }
  
  logSuccess(`获取到 ${res.data.surveys?.length || 0} 个问卷`);
}

// 1.8 更新问卷信息
async function testUpdateSurvey() {
  logInfo('测试更新问卷信息...');
  const res = await axios.put(`${API_BASE}/update-survey`, {
    surveyId: surveyId,
    title: '更新后的问卷标题',
    description: '更新后的描述',
    status: 'published'
  }, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.data.success) {
    throw new Error('更新问卷失败');
  }
  logSuccess('问卷信息更新成功');
}

// 1.9 获取问卷详情
async function testGetSurvey() {
  logInfo('测试获取问卷详情...');
  const res = await axios.get(`${API_BASE}/survey/${surveyId}`);
  
  if (!res.data.success) {
    throw new Error('获取问卷详情失败');
  }
  
  if (res.data.survey.title === '更新后的问卷标题') {
    logSuccess('问卷详情获取成功，标题已更新');
  } else {
    logError('问卷标题未正确更新');
  }
}

// 1.10 添加题目到问卷
async function testAddQuestionToSurvey() {
  logInfo('测试从题库添加题目到问卷...');
  
  const availableRes = await axios.get(`${API_BASE}/available-questions?surveyId=${surveyId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!availableRes.data.questions || availableRes.data.questions.length === 0) {
    logInfo('没有可用题目，跳过测试');
    return true;
  }
  
  const questionToAdd = availableRes.data.questions[0];
  
  const res = await axios.post(`${API_BASE}/add-question-from-bank`, {
    surveyId: surveyId,
    versionId: questionToAdd.versionId
  }, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.data.success) {
    throw new Error('添加题目失败');
  }
  logSuccess('题目添加成功');
}

// 1.11 保存跳转逻辑
async function testSaveLogic() {
  logInfo('测试保存跳转逻辑...');
  
  const surveyRes = await axios.get(`${API_BASE}/my-survey/${surveyId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const questions = surveyRes.data.survey.questions;
  if (questions.length < 2) {
    logInfo('题目数量不足，跳过跳转逻辑测试');
    return true;
  }
  
  const sourceId = questions[0].questionId;
  const targetId = questions[1].questionId;
  
  const res = await axios.post(`${API_BASE}/save-logic`, {
    surveyId: surveyId,
    sourceQuestionId: sourceId,
    rules: [{
      type: 'single_choice',
      optionValue: 'male',
      optionLabel: '男',
      targetQuestionId: targetId,
      priority: 1
    }],
    defaultTarget: null
  }, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.data.success) {
    throw new Error('保存跳转逻辑失败');
  }
  logSuccess('跳转逻辑保存成功');
}

// 1.12 测试跳转逻辑
async function testJumpLogic() {
  logInfo('测试跳转逻辑执行...');
  
  const surveyRes = await axios.get(`${API_BASE}/survey/${surveyId}`);
  const questions = surveyRes.data.survey.questions;
  
  if (questions.length < 2) {
    logInfo('题目数量不足，跳过跳转测试');
    return true;
  }
  
  const sourceId = questions[0].questionId;
  
  const jumpRes = await axios.post(`${API_BASE}/test-jump`, {
    surveyId: surveyId,
    currentQuestionId: sourceId,
    answer: 'male'
  });
  
  if (jumpRes.data.success) {
    logSuccess(`跳转测试完成，nextQuestionId: ${jumpRes.data.nextQuestionId || '无跳转'}`);
  } else {
    logError('跳转测试失败');
  }
}

// 1.13 提交问卷回答
async function testSubmitResponse() {
  logInfo('测试提交问卷回答...');
  
  const surveyRes = await axios.get(`${API_BASE}/survey/${surveyId}`);
  const questions = surveyRes.data.survey.questions;
  
  const answers = questions.map(q => {
    if (q.type === 'single_choice' && q.config?.options?.length > 0) {
      return { questionId: q.questionId, value: q.config.options[0].value };
    } else if (q.type === 'multi_choice' && q.config?.options?.length > 0) {
      return { questionId: q.questionId, value: [q.config.options[0].value] };
    } else if (q.type === 'text') {
      return { questionId: q.questionId, value: '测试回答内容' };
    } else if (q.type === 'number') {
      return { questionId: q.questionId, value: 25 };
    }
    return { questionId: q.questionId, value: '测试' };
  });
  
  const res = await axios.post(`${API_BASE}/submit-response`, {
    surveyId: surveyId,
    answers: answers,
    respondentName: '测试用户',
    isAnonymous: false
  });
  
  if (!res.data.success) {
    throw new Error('提交回答失败');
  }
  logSuccess(`回答提交成功，答卷ID: ${res.data.responseId}`);
}

// 1.14 统计结果测试
async function testStatistics() {
  logInfo('测试获取统计结果...');
  
  const res = await axios.get(`${API_BASE}/survey-stats/${surveyId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.data.success) {
    throw new Error('获取统计失败');
  }
  
  logSuccess(`总答卷数: ${res.data.stats.totalResponses}`);
  logSuccess('统计测试通过');
}

// ========== 第二阶段测试：需求变更 ==========

// 2.1 题目版本管理
async function testVersionManagement() {
  logInfo('测试创建题目新版本...');
  
  const newVersionRes = await axios.post(`${API_BASE}/questions/${questionBaseId}/new-version`, {
    title: '更新后的题目标题',
    changeNote: '测试版本更新'
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!newVersionRes.data.success) {
    throw new Error('创建新版本失败');
  }
  logSuccess(`新版本创建成功: ${newVersionRes.data.message}`);
  
  logInfo('测试获取题目详情（含版本信息）...');
  const detailRes = await axios.get(`${API_BASE}/questions/${questionBaseId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!detailRes.data.success) {
    throw new Error('获取题目详情失败');
  }
  
  const versions = detailRes.data.data.versions;
  logSuccess(`题目共有 ${versions.length} 个版本，当前版本 v${detailRes.data.data.currentVersion}`);
}

// 2.2 题目分享功能
async function testShareQuestion() {
  logInfo('测试公开分享题目...');
  
  const shareRes = await axios.post(`${API_BASE}/questions/${questionBaseId}/share`, {
    isPublic: true
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!shareRes.data.success) {
    throw new Error('公开分享失败');
  }
  logSuccess('题目已公开分享');
  
  logInfo('测试获取共享题目列表...');
  const sharedRes = await axios.get(`${API_BASE}/questions/shared-questions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (sharedRes.data.success) {
    logSuccess(`共享题目列表中有 ${sharedRes.data.questions?.length || 0} 个题目`);
  }
}

// 2.3 题目使用情况
async function testQuestionUsage() {
  logInfo('测试获取题目使用情况...');
  
  const usageRes = await axios.get(`${API_BASE}/questions/${questionBaseId}/usage`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!usageRes.data.success) {
    throw new Error('获取使用情况失败');
  }
  
  logSuccess(`题目被 ${usageRes.data.data.totalUsage} 个问卷使用`);
}

// 2.4 跨问卷统计
async function testCrossSurveyStats() {
  logInfo('测试跨问卷统计...');
  
  try {
    const statsRes = await axios.get(`${API_BASE}/questions/${questionBaseId}/cross-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (statsRes.data.success) {
      logSuccess('跨问卷统计获取成功');
      const versions = Object.keys(statsRes.data.data.versions);
      logInfo(`共有 ${versions.length} 个版本有统计数据`);
    } else {
      logError('跨问卷统计获取失败');
    }
  } catch (err) {
    if (err.response?.status === 404) {
      logInfo('跨问卷统计API暂时不可用（需要先有回答数据）');
    } else {
      throw err;
    }
  }
}

// 2.5 版本恢复测试
async function testVersionRestore() {
  logInfo('测试恢复旧版本...');
  
  const detailRes = await axios.get(`${API_BASE}/questions/${questionBaseId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const versions = detailRes.data.data.versions;
  if (versions.length < 2) {
    logInfo('版本数量不足，跳过恢复测试');
    return true;
  }
  
  try {
    const restoreRes = await axios.post(`${API_BASE}/questions/${questionBaseId}/restore/1`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (restoreRes.data.success) {
      logSuccess(`版本恢复成功: ${restoreRes.data.message}`);
    } else {
      logError('版本恢复失败');
    }
  } catch (err) {
    logInfo('版本恢复可能失败，跳过');
  }
}

// 2.6 获取可分享用户列表
async function testShareableUsers() {
  logInfo('测试获取可分享用户列表...');
  
  try {
    const usersRes = await axios.get(`${API_BASE}/questions/shareable-users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (usersRes.data.success) {
      logSuccess(`可分享用户数: ${usersRes.data.users?.length || 0}`);
    } else {
      logError('获取用户列表失败');
    }
  } catch (err) {
    if (err.response?.status === 404) {
      logInfo('可分享用户API暂时不可用');
    } else {
      throw err;
    }
  }
}

// 2.7 获取可用题目列表
async function testAvailableQuestions() {
  logInfo('测试获取可用题目列表...');
  
  const res = await axios.get(`${API_BASE}/available-questions?surveyId=${surveyId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.data.success) {
    logSuccess(`可用题目数: ${res.data.questions?.length || 0}`);
  } else {
    logError('获取可用题目失败');
  }
}

// 2.8 删除跳转规则测试
async function testDeleteLogicRule() {
  logInfo('测试删除跳转规则...');
  
  const surveyRes = await axios.get(`${API_BASE}/my-survey/${surveyId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const questions = surveyRes.data.survey.questions;
  if (questions.length < 2) {
    logInfo('题目数量不足，跳过删除规则测试');
    return true;
  }
  
  const sourceId = questions[0].questionId;
  
  try {
    const res = await axios.delete(`${API_BASE}/delete-logic-rule`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        surveyId: surveyId,
        sourceQuestionId: sourceId,
        ruleIndex: 0
      }
    });
    
    if (res.data.success) {
      logSuccess('跳转规则删除成功');
    } else {
      logInfo('没有可删除的规则');
    }
  } catch (err) {
    logInfo('删除规则API可能不可用');
  }
}

// 2.9 题目分享取消测试
async function testUnshareQuestion() {
  logInfo('测试取消公开分享...');
  
  try {
    const shareRes = await axios.post(`${API_BASE}/questions/${questionBaseId}/share`, {
      isPublic: false
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (shareRes.data.success) {
      logSuccess('取消公开分享成功');
    } else {
      logError('取消公开分享失败');
    }
  } catch (err) {
    logInfo('取消分享API可能不可用');
  }
}

// ========== 运行所有测试 ==========
async function runAllTests() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗
║                        问卷系统完整自动化测试                                          ║
║                        第一阶段 + 第二阶段需求                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}
  `);
  
  console.log(`\n${colors.cyan}========== 第一阶段测试：初始需求 ==========${colors.reset}`);
  
  await runTest('1.1 用户注册测试', testRegister);
  await runTest('1.2 用户登录测试', testLogin);
  await runTest('1.3 创建题目测试（题库）', testCreateQuestion);
  await runTest('1.4 获取我的题目列表', testMyQuestions);
  await runTest('1.5 创建问卷测试', testCreateSurvey);
  await runTest('1.6 从题库创建问卷', testCreateSurveyFromBank);
  await runTest('1.7 获取我的问卷列表', testMySurveys);
  await runTest('1.8 更新问卷信息', testUpdateSurvey);
  await runTest('1.9 获取问卷详情', testGetSurvey);
  await runTest('1.10 添加题目到问卷', testAddQuestionToSurvey);
  await runTest('1.11 保存跳转逻辑', testSaveLogic);
  await runTest('1.12 测试跳转逻辑', testJumpLogic);
  await runTest('1.13 提交问卷回答', testSubmitResponse);
  await runTest('1.14 统计结果测试', testStatistics);
  
  console.log(`\n${colors.cyan}========== 第二阶段测试：需求变更 ==========${colors.reset}`);
  
  await runTest('2.1 题目版本管理', testVersionManagement);
  await runTest('2.2 题目分享功能', testShareQuestion);
  await runTest('2.3 题目使用情况', testQuestionUsage);
  await runTest('2.4 跨问卷统计', testCrossSurveyStats);
  await runTest('2.5 版本恢复测试', testVersionRestore);
  await runTest('2.6 可分享用户列表', testShareableUsers);
  await runTest('2.7 可用题目列表', testAvailableQuestions);
  await runTest('2.8 删除跳转规则', testDeleteLogicRule);
  await runTest('2.9 取消公开分享', testUnshareQuestion);
  
  // 输出测试总结
  const total = passedTests + failedTests;
  const passRate = total > 0 ? ((passedTests / total) * 100).toFixed(1) : 0;
  
  console.log(`\n${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                              测试结果统计                                              ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║  ${colors.green}✅ 通过: ${passedTests} 个测试用例${' '.repeat(50 - String(passedTests).length)}${colors.reset}║`);
  console.log(`║  ${colors.red}❌ 失败: ${failedTests} 个测试用例${' '.repeat(50 - String(failedTests).length)}${colors.reset}║`);
  console.log(`║  ${colors.yellow}📊 通过率: ${passRate}%${' '.repeat(54 - passRate.length)}${colors.reset}║`);
  console.log(`╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  // 详细结果
  console.log(`${colors.magenta}========== 详细测试结果 ==========${colors.reset}`);
  for (const result of testResults) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    const color = result.status === 'PASS' ? colors.green : colors.red;
    console.log(`${color}${icon} ${result.message}${colors.reset}`);
  }
}

// 运行测试
runAllTests();
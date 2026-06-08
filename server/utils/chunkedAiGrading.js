/**
 * Chunked AI Grading Utility
 *
 * This module breaks down the AI grading process into smaller, more manageable chunks
 * to avoid rate limits and improve reliability.
 */
const groqClient = require('./groqClient');

/**
 * Grade an open-ended answer using a chunked approach with Google Gemini API
 * @param {string} studentAnswer - The student's answer
 * @param {string} modelAnswer - The model answer to compare against
 * @param {number} maxPoints - Maximum points for the question
 * @param {string} questionText - The text of the question being answered (optional)
 * @returns {Object} - Score and feedback
 */
const gradeOpenEndedAnswer = async (studentAnswer, modelAnswer, maxPoints, questionText = '') => {
  try {
    console.log('Starting chunked AI grading process...');
    console.log(`Question text: "${questionText || 'Not provided'}"`);

    // Step 1: Extract key concepts from the model answer or infer from question
    const keyConceptsResult = await extractKeyConcepts(modelAnswer, studentAnswer, questionText);

    // Step 2: Analyze student answer against key concepts and question context
    const analysisResult = await analyzeStudentAnswer(
      studentAnswer,
      keyConceptsResult.keyConcepts,
      maxPoints,
      keyConceptsResult.isModelAnswerMissing,
      questionText
    );

    // Step 3: Generate detailed feedback with question context
    const feedbackResult = await generateFeedback(
      studentAnswer,
      modelAnswer,
      analysisResult.score,
      maxPoints,
      analysisResult.conceptsPresent,
      analysisResult.conceptsMissing,
      questionText
    );

    // Combine results into final grading
    const finalGrading = {
      score: analysisResult.score,
      feedback: feedbackResult.feedback,
      correctedAnswer: feedbackResult.correctedAnswer || modelAnswer,
      details: {
        keyConceptsPresent: analysisResult.conceptsPresent,
        keyConceptsMissing: analysisResult.conceptsMissing
      }
    };

    console.log(`Completed chunked AI grading with score: ${finalGrading.score}/${maxPoints}`);
    return finalGrading;

  } catch (error) {
    console.error('Error in chunked AI grading:', error);

    // Fall back to keyword matching if AI grading fails
    return fallbackKeywordGrading(studentAnswer, modelAnswer, maxPoints, error);
  }
};

/**
 * Extract key concepts from the model answer or generate expected concepts for the topic
 * @param {string} modelAnswer - The model answer
 * @param {string} studentAnswer - The student's answer (used when model answer is missing)
 * @param {string} questionText - The question text (optional)
 * @returns {Object} - Extracted key concepts
 */
const extractKeyConcepts = async (modelAnswer, studentAnswer, questionText = '') => {
  try {
    console.log('Extracting key concepts...');

    // Use fast model for better performance and to avoid timeouts

    // Check if model answer is missing or just says "Not provided"
    const isModelAnswerMissing = !modelAnswer || modelAnswer === "Not provided" || modelAnswer.trim() === "";

    // Truncate long inputs to prevent timeout
    const MAX_LENGTH = 1000;
    const truncatedQuestion = questionText.length > MAX_LENGTH ? questionText.substring(0, MAX_LENGTH) + '...' : questionText;
    const truncatedAnswer = studentAnswer.length > MAX_LENGTH ? studentAnswer.substring(0, MAX_LENGTH) + '...' : studentAnswer;
    const truncatedModelAnswer = modelAnswer && modelAnswer.length > MAX_LENGTH ? modelAnswer.substring(0, MAX_LENGTH) + '...' : modelAnswer;

    let prompt;
    if (isModelAnswerMissing) {
      prompt = `Extract 3-5 BROAD key concepts expected for this answer. Q: "${truncatedQuestion}". A: "${truncatedAnswer}".

IMPORTANT: Extract broad concepts, NOT individual words.
Example: For "Provides energy, Helps growth and body building, Protects the body from diseases"
Correct concepts: ["energy provision", "growth and body building", "disease protection"]
WRONG: ["provides", "energy", "helps", "growth", "body", "building", "protects", "diseases"]

Return JSON array: ["concept1", "concept2", ...]`;
    } else {
      prompt = `Extract 3-5 BROAD key concepts from model answer. Model: "${truncatedModelAnswer}". Context: "${truncatedQuestion}".

IMPORTANT: Extract broad concepts, NOT individual words.
Example: For "Provides energy, Helps growth and body building, Protects the body from diseases"
Correct concepts: ["energy provision", "growth and body building", "disease protection"]
WRONG: ["provides", "energy", "helps", "growth", "body", "building", "protects", "diseases"]

Return JSON array: ["concept1", "concept2", ...]`;
    }

    // OPTIMIZED: Use fast model for key concept extraction
    const result = await groqClient.generateContent(prompt, {
      model: 'fast',
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 512
    });

    const text = result.text;

    // Extract JSON array from response
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No JSON array found in key concepts extraction response');
    }

    const jsonText = text.substring(jsonStart, jsonEnd);
    const keyConcepts = JSON.parse(jsonText);

    console.log(`Successfully extracted ${keyConcepts.length} key concepts`);
    return {
      keyConcepts,
      isModelAnswerMissing
    };

  } catch (error) {
    console.error('Error extracting key concepts:', error);
    // Provide a simple fallback - extract technical terms from the student answer
    const technicalTerms = extractTechnicalTerms(studentAnswer);
    return {
      keyConcepts: technicalTerms.length > 0 ? technicalTerms : ["technical knowledge", "clear explanation", "relevant concepts"],
      isModelAnswerMissing: !modelAnswer || modelAnswer === "Not provided" || modelAnswer.trim() === ""
    };
  }
};

/**
 * Extract technical terms from text
 * @param {string} text - The text to extract terms from
 * @returns {Array} - Array of technical terms
 */
const extractTechnicalTerms = (text) => {
  // List of common technical terms in computer science/IT
  const technicalTermPatterns = [
    /\b(?:kernel|memory|cpu|processor|algorithm|data structure|network|protocol|api|interface|function|method|class|object|variable|database|query|server|client|cache|buffer|thread|process|synchronization|asynchronous|concurrent|parallel|distributed|encryption|decryption|authentication|authorization|security|firewall|router|switch|gateway|dns|dhcp|tcp\/ip|http|https|ftp|ssh|ssl|tls|xml|json|html|css|javascript|python|java|c\+\+|c#|ruby|php|sql|nosql|mongodb|mysql|postgresql|oracle|redis|docker|kubernetes|virtualization|cloud|aws|azure|google cloud|microservice|architecture|design pattern|framework|library|module|component|dependency|injection|inheritance|polymorphism|encapsulation|abstraction|interface|implementation|compiler|interpreter|assembler|linker|loader|debugger|testing|unit test|integration test|system test|acceptance test|regression test|performance test|stress test|load test|scalability|reliability|availability|maintainability|usability|accessibility|internationalization|localization|optimization|refactoring|version control|git|svn|continuous integration|continuous deployment|agile|scrum|kanban|waterfall|requirements|specification|documentation|uml|erd|flowchart|pseudocode|algorithm|complexity|big o notation|time complexity|space complexity|sorting|searching|graph|tree|linked list|array|stack|queue|hash table|heap|binary search|depth-first search|breadth-first search|dynamic programming|greedy algorithm|divide and conquer|recursion|iteration|loop|conditional|statement|expression|operator|operand|parameter|argument|return value|exception|error handling|debugging|logging|monitoring|profiling|benchmarking|optimization|performance|security|vulnerability|exploit|attack|defense|mitigation|risk|threat|vulnerability|assessment|audit|compliance|regulation|standard|best practice|pattern|anti-pattern|code smell|technical debt|legacy code|maintenance|support|documentation|specification|requirement|user story|use case|scenario|test case|test suite|test plan|test strategy|test automation|manual testing|exploratory testing|black box testing|white box testing|gray box testing|unit testing|integration testing|system testing|acceptance testing|regression testing|performance testing|load testing|stress testing|security testing|penetration testing|vulnerability scanning|code review|peer review|pair programming|mob programming|extreme programming|test-driven development|behavior-driven development|domain-driven design|model-view-controller|model-view-viewmodel|repository pattern|factory pattern|singleton pattern|observer pattern|strategy pattern|command pattern|adapter pattern|facade pattern|decorator pattern|proxy pattern|bridge pattern|composite pattern|flyweight pattern|chain of responsibility pattern|mediator pattern|memento pattern|state pattern|template method pattern|visitor pattern|interpreter pattern)\b/gi,
    /\b(?:bootloader|task scheduling|optimization|memory management|device driver|interrupt handling|system call|file system|input\/output|i\/o|hardware|software|firmware|operating system|os|linux|windows|macos|unix|android|ios|embedded system|real-time system|batch system|time-sharing system|distributed system|client-server|peer-to-peer|master-slave|producer-consumer|publisher-subscriber|request-response|push-pull|event-driven|message-driven|service-oriented|microservice|monolithic|layered|tiered|n-tier|frontend|backend|full-stack|web|mobile|desktop|embedded|iot|internet of things|big data|data mining|machine learning|artificial intelligence|natural language processing|computer vision|robotics|augmented reality|virtual reality|mixed reality|blockchain|cryptocurrency|smart contract|quantum computing|edge computing|fog computing|grid computing|high-performance computing|supercomputing|cluster computing|parallel computing|distributed computing|cloud computing|serverless computing|infrastructure as a service|platform as a service|software as a service|function as a service|backend as a service|database as a service|storage as a service|security as a service|monitoring as a service|logging as a service|testing as a service|continuous integration|continuous delivery|continuous deployment|devops|devsecops|gitops|infrastructure as code|configuration as code|everything as code|shift left|shift right|blue-green deployment|canary deployment|rolling deployment|a\/b testing|feature flag|feature toggle|dark launch|silent launch|soft launch|hard launch|beta testing|alpha testing|user acceptance testing|smoke testing|sanity testing|exploratory testing|regression testing|performance testing|load testing|stress testing|volume testing|scalability testing|reliability testing|availability testing|security testing|penetration testing|vulnerability scanning|static analysis|dynamic analysis|code review|peer review|pair programming|mob programming|extreme programming|test-driven development|behavior-driven development|domain-driven design|model-view-controller|model-view-viewmodel|repository pattern|factory pattern|singleton pattern|observer pattern|strategy pattern|command pattern|adapter pattern|facade pattern|decorator pattern|proxy pattern|bridge pattern|composite pattern|flyweight pattern|chain of responsibility pattern|mediator pattern|memento pattern|state pattern|template method pattern|visitor pattern|interpreter pattern)\b/gi,
    /\b(?:hdd|ssd|ram|rom|cpu|gpu|alu|fpu|mmu|tlu|cache|l1|l2|l3|dram|sram|prom|eprom|eeprom|flash|usb|pci|pcie|sata|ide|scsi|raid|nas|san|lan|wan|man|pan|vpn|vlan|wlan|wifi|bluetooth|zigbee|z-wave|lora|nb-iot|gsm|cdma|tdma|fdma|ofdm|qam|psk|fsk|am|fm|pm|ftp|sftp|tftp|http|https|smtp|pop3|imap|dns|dhcp|arp|rarp|icmp|igmp|tcp|udp|ip|ipv4|ipv6|ospf|bgp|rip|eigrp|mpls|vpn|nat|pat|firewall|router|switch|hub|bridge|gateway|modem|repeater|access point|load balancer|proxy|reverse proxy|cdn|dns|dhcp|ldap|radius|tacacs|kerberos|oauth|openid|saml|jwt|ssl|tls|ssh|telnet|rsh|rlogin|vnc|rdp|x11|wayland|mir|directx|opengl|vulkan|metal|cuda|opencl|openmp|mpi|hadoop|spark|kafka|rabbitmq|activemq|zeromq|mqtt|amqp|stomp|jms|soap|rest|graphql|grpc|thrift|avro|protobuf|json|xml|yaml|toml|ini|csv|tsv|markdown|html|css|javascript|typescript|java|c|c\+\+|c#|python|ruby|go|rust|swift|kotlin|scala|perl|php|bash|powershell|sql|plsql|tsql|mysql|postgresql|oracle|sql server|mongodb|cassandra|redis|neo4j|elasticsearch|solr|hadoop|spark|kafka|flume|sqoop|hive|pig|impala|presto|druid|airflow|nifi|kubernetes|docker|podman|lxc|lxd|vagrant|terraform|ansible|puppet|chef|salt|jenkins|travis|circleci|github actions|gitlab ci|teamcity|bamboo|hudson|maven|gradle|ant|npm|yarn|pip|conda|virtualenv|venv|poetry|bundler|composer|nuget|cargo|go modules|maven|gradle|sbt|leiningen|bazel|buck|pants|make|cmake|autotools|ninja|qmake|meson|xcode|visual studio|eclipse|intellij|netbeans|vscode|atom|sublime|vim|emacs|notepad\+\+|git|svn|mercurial|perforce|clearcase|tfs|vss|rcs|cvs|bitbucket|github|gitlab|gitea|gogs|azure devops|jira|trello|asana|basecamp|slack|teams|discord|zoom|webex|meet|skype|telegram|whatsapp|signal|matrix|irc|xmpp|sip|h.323|webrtc|rtmp|rtsp|hls|dash|mpeg|h.264|h.265|vp8|vp9|av1|aac|mp3|opus|flac|wav|ogg|webm|mp4|mkv|avi|mov|wmv|flv)\b/gi
  ];

  // Extract terms
  const terms = new Set();
  for (const pattern of technicalTermPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => terms.add(match.toLowerCase()));
    }
  }

  return Array.from(terms);
};

/**
 * Detect if question has multiple parts (a, b, c, etc. or i, ii, iii, etc.)
 * @param {string} questionText - The question text
 * @returns {Object} - Detection result with isMultiPart and expectedParts count
 */
const detectMultiPartQuestion = (questionText) => {
  if (!questionText) return { isMultiPart: false, expectedParts: 1 };

  // More conservative multi-part detection
  // Only detect as multi-part if there are clear structural indicators
  const letterParts = questionText.match(/\b[a-z]\)[\s]|\([a-z]\)[\s]|\\b[a-z]\.[\s]/gi);
  const romanParts = questionText.match(/\b[i]{1,3}\)[\s]|\([i]{1,3}\)[\s]/gi);
  const numberParts = questionText.match(/\b\d+\)[\s]|\(\d+\)[\s]/gi);

  const allParts = [...(letterParts || []), ...(romanParts || []), ...(numberParts || [])];
  const uniqueParts = new Set(allParts.map(p => p.toLowerCase().replace(/[\(\)\[\]\s\.:]/g, '')));

  // Check for explicit "part" language or numbered list format
  const hasExplicitParts = /(?:part|section|step)\s*\d+/i.test(questionText);
  const hasNumberedList = /\d+\)[\s]|\d+\.[\s]/.test(questionText) && (questionText.match(/\d+\)[\s]|\d+\.[\s]/g) || []).length > 1;

  // Check for multiple marks indicators like (1 mark), (2 marks), (4 marks)
  const marksPattern = questionText.match(/\(\s*\d+\s*(?:mark|marks)\s*\)/gi);
  const totalMarks = marksPattern ? marksPattern.reduce((sum, m) => {
    const num = parseInt(m.match(/\d+/)[0]);
    return sum + num;
  }, 0) : 0;

  // Only consider it multi-part if there are at least 2 clearly labeled parts
  // AND it's not a simple math/calculation question
  const isCalculationQuestion = /calculate|compute|find|solve|determine|what is|how much|how many/i.test(questionText);

  return {
    isMultiPart: (uniqueParts.size >= 2 || hasExplicitParts || hasNumberedList) && !isCalculationQuestion,
    expectedParts: Math.max(uniqueParts.size, 1),
    totalMarks: totalMarks,
    detectedParts: Array.from(uniqueParts)
  };
};

/**
 * Validate that a multi-part question has been fully answered
 * @param {string} studentAnswer - The student's answer
 * @param {Object} multiPartInfo - Info from detectMultiPartQuestion
 * @returns {Object} - Validation result
 */
const validateMultiPartAnswer = (studentAnswer, multiPartInfo) => {
  if (!multiPartInfo.isMultiPart || !studentAnswer) {
    return { isValid: true, partsFound: 1, partsMissing: 0 };
  }

  const answer = studentAnswer.toLowerCase();
  const partsFound = multiPartInfo.detectedParts.filter(part => {
    // Check if this part label appears in the answer
    const partPatterns = [
      new RegExp(`\\b${part}\\s*[\.\),:=-]`, 'i'),
      new RegExp(`\\(${part}\\)`, 'i'),
      new RegExp(`\\[${part}\\]`, 'i')
    ];
    return partPatterns.some(pattern => pattern.test(answer));
  }).length;

  const partsMissing = multiPartInfo.expectedParts - partsFound;

  return {
    isValid: partsFound >= multiPartInfo.expectedParts * 0.5, // At least 50% of parts
    partsFound,
    partsMissing,
    completeness: partsFound / multiPartInfo.expectedParts
  };
};

/**
 * Analyze student answer against key concepts
 * @param {string} studentAnswer - The student's answer
 * @param {Array} keyConcepts - Key concepts from the model answer
 * @param {number} maxPoints - Maximum points for the question
 * @param {boolean} isModelAnswerMissing - Whether the model answer is missing
 * @param {string} questionText - The text of the question being answered (optional)
 * @returns {Object} - Analysis results
 */
const analyzeStudentAnswer = async (studentAnswer, keyConcepts, maxPoints, isModelAnswerMissing = false, questionText = '') => {
  try {
    console.log('Analyzing student answer against key concepts...');

    // Check for multi-part questions first
    const multiPartInfo = detectMultiPartQuestion(questionText);
    const multiPartValidation = validateMultiPartAnswer(studentAnswer, multiPartInfo);

    // For severely incomplete multi-part answers (< 25%), log but still attempt grading
    // This allows partial credit for calculation questions that might be misdetected
    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 0.25) {
      console.log(`Multi-part question severely incomplete: ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts found`);
      console.log(`⚠️ Attempting fallback grading for potentially misdetected multi-part question`);
      // Don't return 0, continue to attempt grading
    }

    // Use fast model for better performance and to avoid timeouts

    // Extract technical terms from the student's answer
    const technicalTerms = extractTechnicalTerms(studentAnswer);
    console.log('Technical terms in student answer:', technicalTerms);

    let prompt;
    if (isModelAnswerMissing) {
      // If model answer is missing, evaluate the technical merit of the student's answer in context of the question
      prompt = `
      You are an expert AI exam grader for a computer science or IT exam with comprehensive knowledge of modern technology and educational assessment. Your task is to evaluate the technical merit of a student's answer with precision and fairness.

      Question: "${questionText || 'Unknown computer science/IT question'}"

      Student Answer: "${studentAnswer}"

      Technical terms identified in the answer: ${JSON.stringify(technicalTerms)}

      Expected key concepts for this topic: ${JSON.stringify(keyConcepts)}

      Grading Instructions:
      1. USE YOUR KNOWLEDGE: Use your own comprehensive knowledge to evaluate if the student's answer is factually correct, not just keyword matching
      2. Carefully analyze how well the student's answer addresses each expected key concept
      3. Consider both explicit mentions and implicit understanding of concepts
      4. Evaluate the technical accuracy of all statements made
      5. Assess the completeness and depth of the explanation
      6. Consider the clarity and organization of the response
      7. Recognize alternative valid approaches or terminology

      Important guidelines:
      - Use current, up-to-date knowledge when evaluating answers
      - If the student's answer is factually correct based on your knowledge, award full points even if it differs from the model answer
      - Consider that there may be multiple valid answers to technical questions
      - For example, both USB and PS/2 could be valid answers for keyboard connections, with USB being more modern
      - Accept answers that are technically correct even if they use different terminology
      - Be flexible with terminology if the student's answer demonstrates understanding of the concept
      - Avoid penalizing for minor formatting or grammatical issues
      - Reward depth of understanding over mere keyword matching
      - BE GENEROUS: If the student demonstrates correct understanding, award appropriate credit regardless of exact wording

      Scoring Guidelines:
      - 90-100% of points: Comprehensive answer that demonstrates mastery of ALL key concepts
      - 80-89% of points: Strong answer addressing most key concepts with minor omissions
      - 70-79% of points: Good answer covering most key concepts but lacking depth
      - 60-69% of points: Adequate answer with some key concepts but significant gaps
      - 50-59% of points: Basic answer showing limited understanding
      - 30-49%: Poor answer with major gaps
      - 10-29%: Very poor answer, minimal understanding shown
      - 0-9%: Insufficient or completely incorrect answer

      CRITICAL RULES:
      1. For multi-part questions, ALL parts must be addressed for full marks
      2. For calculation questions: Extract the final numerical result and verify it's correct. Correct method with wrong result = 30-50% partial credit
      3. Mathematical expressions are acceptable for calculation questions - evaluate the numerical result
      4. For brief answers: Be lenient - award partial credit if the approach is correct, even if incomplete
      5. Do NOT give automatic partial credit - evaluate actual content quality, but award partial credit for correct approach

      Assign a precise score between 0 and ${maxPoints} based on how well the answer addresses the specific question.
      Be STRICT and fair - incomplete answers should receive proportionally lower scores.

      Format your response as a JSON object:
      {
        "conceptsPresent": ["concept1", "concept2", ...],
        "conceptsMissing": ["concept3", "concept4", ...],
        "score": (number between 0 and ${maxPoints}, can include decimal points for precision),
        "technicalMerit": "brief assessment of technical accuracy and relevance to the question"
      }

      Only return the JSON object, nothing else.
      `;
    } else {
      // If model answer is available, compare against key concepts in context of the question
      prompt = `
      You are an expert AI exam grader with comprehensive knowledge of modern technology and educational assessment. Your task is to analyze how well a student's answer addresses the question and covers the key concepts with precision and fairness.

      Question: "${questionText || 'Unknown computer science/IT question'}"

      Student Answer: "${studentAnswer}"

      Key Concepts: ${JSON.stringify(keyConcepts)}

      Grading Instructions:
      1. USE YOUR KNOWLEDGE: Use your own comprehensive knowledge to evaluate if the student's answer is factually correct, not just keyword matching
      2. Carefully analyze how well the student's answer addresses each key concept
      3. Consider both explicit mentions and implicit understanding of concepts
      4. Evaluate the technical accuracy of all statements made
      5. Assess the completeness and depth of the explanation
      6. Consider the clarity and organization of the response
      7. Recognize alternative valid approaches or terminology

      Important guidelines:
      - Use current, up-to-date knowledge when evaluating answers
      - If the student's answer is factually correct based on your knowledge, award full points even if it differs from the model answer
      - Consider that there may be multiple valid answers to technical questions
      - For example, both USB and PS/2 could be valid answers for keyboard connections, with USB being more modern
      - Accept answers that are technically correct even if they use different terminology
      - Be flexible with terminology if the student's answer demonstrates understanding of the concept
      - Avoid penalizing for minor formatting or grammatical issues
      - Reward depth of understanding over mere keyword matching
      - BE GENEROUS: If the student demonstrates correct understanding, award appropriate credit regardless of exact wording

      Scoring Guidelines:
      - 90-100% of points: Comprehensive answer that demonstrates mastery of ALL key concepts
      - 80-89% of points: Strong answer addressing most key concepts with minor omissions
      - 70-79% of points: Good answer covering most key concepts but lacking depth
      - 60-69% of points: Adequate answer with some key concepts but significant gaps
      - 50-59% of points: Basic answer showing limited understanding
      - 30-49%: Poor answer with major gaps
      - 10-29%: Very poor answer, minimal understanding shown
      - 0-9%: Insufficient or completely incorrect answer

      CRITICAL RULES:
      1. For multi-part questions, ALL parts must be addressed for full marks
      2. For calculation questions: Extract the final numerical result and verify it's correct. Correct method with wrong result = 30-50% partial credit
      3. Mathematical expressions are acceptable for calculation questions - evaluate the numerical result
      4. For brief answers: Be lenient - award partial credit if the approach is correct, even if incomplete
      5. Do NOT give automatic partial credit - evaluate actual content quality, but award partial credit for correct approach

      For each key concept, determine if it is present in the student's answer.
      Then assign a precise score between 0 and ${maxPoints} based on:
      1. How many key concepts are covered (both quantity and quality of coverage)
      2. How well the answer addresses ALL parts of the specific question asked
      3. Technical accuracy and clarity of the explanation
      4. Depth of understanding demonstrated

      Be STRICT - an incomplete answer to a multi-part question should receive a score proportional to parts answered.

      Format your response as a JSON object:
      {
        "conceptsPresent": ["concept1", "concept2", ...],
        "conceptsMissing": ["concept3", "concept4", ...],
        "score": (number between 0 and ${maxPoints}, can include decimal points for precision),
        "relevance": "brief assessment of how well the answer addresses the question"
      }

      Only return the JSON object, nothing else.
      `;
    }

    // OPTIMIZED: Use fast model for student answer analysis
    const result = await groqClient.generateContent(prompt, {
      model: 'fast',
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 512
    });

    const text = result.text;

    // Parse JSON response
    let analysis;
    if (result.parsedContent) {
      analysis = result.parsedContent;
    } else {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;

      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No JSON object found in analysis response');
      }

      const jsonText = text.substring(jsonStart, jsonEnd);
      analysis = JSON.parse(jsonText);
    }

    // REMOVED: Automatic score boosting based on technical terms
    // Score should reflect actual answer quality, not just presence of keywords

    // Apply multi-part scaling - award proportional marks for answered parts
    // If student answered 1 of 4 parts correctly, they get 25% of the total points
    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0) {
      const proportionalScore = Math.round(maxPoints * multiPartValidation.completeness);
      // Cap the score at the proportional limit based on parts answered
      // This ensures if they answer 1/4 parts, max they can get is 25% of total
      const cappedScore = Math.min(analysis.score, proportionalScore);
      console.log(`Multi-part scaling applied: ${analysis.score} -> ${cappedScore} (max ${Math.round(multiPartValidation.completeness * 100)}% for ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts)`);
      analysis.score = cappedScore;
      analysis.multiPartScaling = {
        maxPossibleForAnsweredParts: proportionalScore,
        completeness: multiPartValidation.completeness,
        partsFound: multiPartValidation.partsFound,
        partsExpected: multiPartInfo.expectedParts
      };
    }

    console.log(`Analysis complete. Score: ${analysis.score}/${maxPoints}`);
    return analysis;

  } catch (error) {
    console.error('Error analyzing student answer:', error);

    // Fallback: Check multi-part validation even on error
    const multiPartInfo = detectMultiPartQuestion(questionText);
    const multiPartValidation = validateMultiPartAnswer(studentAnswer, multiPartInfo);

    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 0.25) {
      return {
        conceptsPresent: [],
        conceptsMissing: keyConcepts,
        score: 0,
        technicalMerit: `Incomplete answer - not all parts addressed`,
        error: error.message
      };
    }

    // If no technical terms or error, fall back to keyword matching
    return fallbackKeywordGrading(studentAnswer, keyConcepts.join(' '), maxPoints, error, questionText);
  }
};

/**
 * Generate detailed feedback for the student
 * @param {string} studentAnswer - The student's answer
 * @param {string} modelAnswer - The model answer
 * @param {number} score - The assigned score
 * @param {number} maxPoints - Maximum points for the question
 * @param {Array} conceptsPresent - Concepts present in student answer
 * @param {Array} conceptsMissing - Concepts missing from student answer
 * @param {string} questionText - The text of the question being answered (optional)
 * @returns {Object} - Feedback and corrected answer
 */
const generateFeedback = async (studentAnswer, modelAnswer, score, maxPoints, conceptsPresent, conceptsMissing, questionText = '') => {
  try {
    console.log('Generating detailed feedback...');

    // Use fast model for better performance and to avoid timeouts

    const prompt = `
    You are an AI exam grader for students in Rwanda with up-to-date knowledge of modern technology and computer systems. Generate helpful feedback for this student.

    Question: "${questionText || 'Unknown computer science/IT question'}"

    Student Answer: "${studentAnswer}"

    Model Answer: "${modelAnswer}"

    Score: ${score}/${maxPoints}

    Concepts Present: ${JSON.stringify(conceptsPresent)}
    Concepts Missing: ${JSON.stringify(conceptsMissing)}

    Important guidelines:
    - Use current, up-to-date knowledge when evaluating answers
    - Consider that there may be multiple valid answers to technical questions
    - For example, both USB and PS/2 could be valid answers for keyboard connections, with USB being more modern
    - Accept answers that are technically correct even if they differ from the model answer
    - Be flexible with terminology if the student's answer demonstrates understanding of the concept

    Please provide:
    1. Detailed feedback explaining the score, including specific strengths and areas for improvement.
    2. A corrected answer that shows what a perfect answer would include for this specific question.

    Format your response as a JSON object:
    {
      "feedback": "your detailed feedback here, including specific strengths and areas for improvement",
      "correctedAnswer": "a model answer that would receive full points for this specific question"
    }

    Be encouraging but honest in your feedback. Focus on helping the student improve.
    Make sure your feedback and corrected answer are directly relevant to the question that was asked.
    Only return the JSON object, nothing else.
    `;

    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 1024,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    const text = response.text();

    // Extract JSON object from response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No JSON object found in feedback response');
    }

    const jsonText = text.substring(jsonStart, jsonEnd);
    const feedback = JSON.parse(jsonText);

    console.log('Successfully generated detailed feedback');
    return feedback;

  } catch (error) {
    console.error('Error generating feedback:', error);
    // Provide a simple fallback
    return {
      feedback: generateFallbackFeedback(score, maxPoints, conceptsPresent, conceptsMissing),
      correctedAnswer: modelAnswer
    };
  }
};

/**
 * Generate fallback feedback when AI feedback generation fails
 */
const generateFallbackFeedback = (score, maxPoints, conceptsPresent, conceptsMissing) => {
  const percentage = (score / maxPoints) * 100;

  let feedback = '';
  if (percentage >= 80) {
    feedback = 'Excellent work! Your answer covers most of the key concepts.';
  } else if (percentage >= 60) {
    feedback = 'Good job! Your answer includes many important concepts, but there are some areas for improvement.';
  } else if (percentage >= 40) {
    feedback = 'Your answer covers some key points, but needs more development.';
  } else {
    feedback = 'Your answer is missing most of the key concepts expected in the model answer.';
  }

  if (conceptsPresent && conceptsPresent.length > 0) {
    feedback += ` You correctly included: ${conceptsPresent.join(', ')}.`;
  }

  if (conceptsMissing && conceptsMissing.length > 0) {
    feedback += ` You should also have included: ${conceptsMissing.join(', ')}.`;
  }

  feedback += ' (Note: This feedback was generated using a fallback system due to AI unavailability)';

  return feedback;
};

/**
 * Fallback grading using keyword matching when AI grading fails
 */
const fallbackKeywordGrading = (studentAnswer, modelAnswer, maxPoints, error, questionText = '') => {
  console.log('Using fallback keyword grading...');

  const studentAns = studentAnswer.toLowerCase().trim();
  const modelAns = typeof modelAnswer === 'string' ? modelAnswer.toLowerCase().trim() :
                  (Array.isArray(modelAnswer) ? modelAnswer.join(' ').toLowerCase().trim() : '');

  // First check for exact match (case-insensitive and ignoring extra whitespace)
  if (typeof modelAnswer === 'string' && studentAns === modelAns) {
    console.log('Exact match found between student answer and model answer!');
    return {
      score: maxPoints,
      feedback: 'Your answer is exactly correct! It matches the expected answer perfectly.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 1.0,
        exactMatch: true,
        error: error.message
      }
    };
  }

  // Check for near-exact match (removing punctuation and parentheses)
  const cleanStudentAns = studentAns.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ");
  const cleanModelAns = modelAns.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ");

  if (typeof modelAnswer === 'string' && cleanStudentAns === cleanModelAns) {
    console.log('Near-exact match found between student answer and model answer!');
    return {
      score: maxPoints,
      feedback: 'Your answer is correct! It matches the expected answer.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 1.0,
        nearExactMatch: true,
        error: error.message
      }
    };
  }

  // Check if student answer contains key phrases from model answer
  const modelKeywords = modelAns.split(/\s+/).filter(word => word.length >= 3);

  // Count matches, giving partial credit for partial matches
  let matchCount = 0;
  for (const keyword of modelKeywords) {
    if (studentAns.includes(keyword)) {
      matchCount += 1; // Full match
    } else if (keyword.length > 4) {
      // For longer words, check if at least 70% of the word is present
      const partialMatches = studentAns.split(/\s+/).filter(word =>
        word.length >= 3 &&
        (keyword.includes(word) || word.includes(keyword.substring(0, Math.floor(keyword.length * 0.7))))
      );
      if (partialMatches.length > 0) {
        matchCount += 0.5; // Partial match
      }
    }
  }

  // Calculate match percentage - NO minimum score guarantee
  // Answers must actually match to receive points
  const matchPercentage = modelKeywords.length > 0
    ? matchCount / modelKeywords.length
    : 0;

  // Assign score based on keyword match percentage
  let score = Math.round(matchPercentage * maxPoints);

  // Apply multi-part scaling for proportional marks
  if (questionText) {
    const multiPartInfo = detectMultiPartQuestion(questionText);
    const multiPartValidation = validateMultiPartAnswer(studentAnswer, multiPartInfo);

    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0 && multiPartValidation.completeness >= 0.25) {
      const proportionalScore = Math.round(maxPoints * multiPartValidation.completeness);
      const cappedScore = Math.min(score, proportionalScore);
      console.log(`Fallback multi-part scaling: ${score} -> ${cappedScore} (max ${Math.round(multiPartValidation.completeness * 100)}% for ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts)`);
      score = cappedScore;
    }
  }

  // Generate appropriate feedback based on score
  let feedback;
  if (score >= maxPoints * 0.8) {
    feedback = 'Your answer covers most of the key concepts from the model answer.';
  } else if (score >= maxPoints * 0.5) {
    feedback = 'Your answer includes some important concepts, but is missing others.';
  } else if (score >= maxPoints * 0.3) {
    feedback = 'Your answer touches on a few key points, but needs more development.';
  } else {
    feedback = 'Your answer is missing most of the key concepts expected in the model answer.';
  }

  console.log(`Applied fallback grading with score: ${score}/${maxPoints} (${Math.round(matchPercentage * 100)}% match)`);

  return {
    score: score,
    feedback: `${feedback} (Note: This was graded using keyword matching due to AI grading unavailability)`,
    correctedAnswer: typeof modelAnswer === 'string' ? modelAnswer : (Array.isArray(modelAnswer) ? modelAnswer.join(' ') : ''),
    details: {
      matchPercentage: matchPercentage,
      keywordsFound: matchCount,
      totalKeywords: modelKeywords.length,
      error: error.message
    }
  };
};

module.exports = {
  gradeOpenEndedAnswer
};

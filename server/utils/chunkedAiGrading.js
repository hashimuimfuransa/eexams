/**
 * Chunked AI Grading Utility
 *
 * This module breaks down the AI grading process into smaller, more manageable chunks
 * to avoid rate limits and improve reliability.
 */
const geminiClient = require('./geminiClient');

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

    // Use a faster model for better performance and to avoid timeouts
    const model = geminiClient.getModel('gemini-1.5-flash');

    // Check if model answer is missing or just says "Not provided"
    const isModelAnswerMissing = !modelAnswer || modelAnswer === "Not provided" || modelAnswer.trim() === "";

    let prompt;
    if (isModelAnswerMissing) {
      // If model answer is missing, generate expected concepts based on the student answer and question
      prompt = `
      You are an expert AI exam grader for a computer science or IT exam with comprehensive knowledge of modern technology and educational assessment.

      Question: "${questionText || 'Unknown question about computer science or IT'}"

      Student Answer: "${studentAnswer}"

      Based on the question and the student's answer, identify 4-8 key technical concepts, facts, and principles that would be expected in a complete and accurate answer to this question.

      For each concept:
      1. Be specific and precise (e.g., "TCP three-way handshake" rather than just "TCP")
      2. Focus on factual information rather than vague ideas
      3. Include technical terms where appropriate
      4. Consider both breadth (covering all aspects of the question) and depth (important details)
      5. Prioritize modern, current technology standards and practices

      Important guidelines:
      - Use current, up-to-date knowledge when identifying key concepts
      - Consider that there may be multiple valid technical approaches to answering questions
      - For example, both USB and PS/2 could be valid concepts for keyboard connections, with USB being more modern
      - Focus on concepts that demonstrate understanding rather than specific terminology
      - Identify concepts that would be used by expert graders to assess student understanding

      Format your response as a JSON array of strings:
      ["concept1", "concept2", "concept3", ...]

      Only return the JSON array, nothing else.
      `;
    } else {
      // If model answer is available, extract concepts from it
      prompt = `
      You are an expert AI exam grader with comprehensive knowledge of modern technology and educational assessment. Your task is to extract the key concepts from this model answer.

      Model Answer: "${modelAnswer}"

      Question Context: "${questionText || 'Unknown computer science/IT question'}"

      Please identify 4-8 key concepts, facts, and principles that are essential to this answer. These are the specific points that would be used to assess a student's understanding.

      For each concept:
      1. Be specific and precise (e.g., "TCP three-way handshake" rather than just "TCP")
      2. Focus on factual information rather than vague ideas
      3. Include technical terms where appropriate
      4. Consider both breadth (covering all aspects) and depth (important details)
      5. Prioritize concepts that demonstrate mastery of the subject

      Important guidelines:
      - Use current, up-to-date knowledge when identifying key concepts
      - Consider that there may be multiple valid technical approaches to answering questions
      - Focus on concepts that demonstrate understanding rather than specific terminology
      - Be flexible with terminology if different terms can express the same concept
      - Identify concepts that would be used by expert graders to assess student understanding

      Format your response as a JSON array of strings:
      ["concept1", "concept2", "concept3", ...]

      Only return the JSON array, nothing else.
      `;
    }

    const generationConfig = {
      temperature: 0.1,
      maxOutputTokens: 1024,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    const text = response.text();

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

    // Use a faster model for better performance and to avoid timeouts
    const model = geminiClient.getModel('gemini-1.5-flash');

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
      1. Carefully analyze how well the student's answer addresses each expected key concept
      2. Consider both explicit mentions and implicit understanding of concepts
      3. Evaluate the technical accuracy of all statements made
      4. Assess the completeness and depth of the explanation
      5. Consider the clarity and organization of the response
      6. Recognize alternative valid approaches or terminology

      Important guidelines:
      - Use current, up-to-date knowledge when evaluating answers
      - Consider that there may be multiple valid answers to technical questions
      - For example, both USB and PS/2 could be valid answers for keyboard connections, with USB being more modern
      - Accept answers that are technically correct even if they use different terminology
      - Be flexible with terminology if the student's answer demonstrates understanding of the concept
      - Avoid penalizing for minor formatting or grammatical issues
      - Reward depth of understanding over mere keyword matching

      Scoring Guidelines:
      - 90-100% of points: Comprehensive answer that demonstrates mastery of all key concepts
      - 80-89% of points: Strong answer with minor omissions or inaccuracies
      - 70-79% of points: Good answer that covers most key concepts but lacks some depth
      - 60-69% of points: Adequate answer with some key concepts but significant gaps
      - 50-59% of points: Basic answer that shows limited understanding
      - Below 50%: Insufficient answer with major gaps or inaccuracies

      Assign a precise score between 0 and ${maxPoints} based on how well the answer addresses the specific question.
      Be fair and consistent in your evaluation, providing the exact score the answer deserves.

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
      1. Carefully analyze how well the student's answer addresses each key concept
      2. Consider both explicit mentions and implicit understanding of concepts
      3. Evaluate the technical accuracy of all statements made
      4. Assess the completeness and depth of the explanation
      5. Consider the clarity and organization of the response
      6. Recognize alternative valid approaches or terminology

      Important guidelines:
      - Use current, up-to-date knowledge when evaluating answers
      - Consider that there may be multiple valid answers to technical questions
      - For example, both USB and PS/2 could be valid answers for keyboard connections, with USB being more modern
      - Accept answers that are technically correct even if they use different terminology
      - Be flexible with terminology if the student's answer demonstrates understanding of the concept
      - Avoid penalizing for minor formatting or grammatical issues
      - Reward depth of understanding over mere keyword matching

      Scoring Guidelines:
      - 90-100% of points: Comprehensive answer that demonstrates mastery of all key concepts
      - 80-89% of points: Strong answer with minor omissions or inaccuracies
      - 70-79% of points: Good answer that covers most key concepts but lacks some depth
      - 60-69% of points: Adequate answer with some key concepts but significant gaps
      - 50-59% of points: Basic answer that shows limited understanding
      - Below 50%: Insufficient answer with major gaps or inaccuracies

      For each key concept, determine if it is present in the student's answer.
      Then assign a precise score between 0 and ${maxPoints} based on:
      1. How many key concepts are covered (both quantity and quality of coverage)
      2. How well the answer addresses the specific question asked
      3. Technical accuracy and clarity of the explanation
      4. Depth of understanding demonstrated

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

    const generationConfig = {
      temperature: 0.1,
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
      throw new Error('No JSON object found in analysis response');
    }

    const jsonText = text.substring(jsonStart, jsonEnd);
    const analysis = JSON.parse(jsonText);

    // If the model answer is missing and the student provided technical terms,
    // ensure a minimum score based on the number of technical terms
    if (isModelAnswerMissing && technicalTerms.length > 0) {
      // Calculate a minimum score based on technical terms (at least 30% of max points if they used technical terms)
      const minScore = Math.ceil(maxPoints * Math.min(0.3 + (technicalTerms.length * 0.1), 0.7));

      // Ensure the score is at least the minimum score
      if (analysis.score < minScore) {
        console.log(`Adjusting score from ${analysis.score} to ${minScore} based on technical terms`);
        analysis.score = minScore;
      }
    }

    console.log(`Analysis complete. Score: ${analysis.score}/${maxPoints}`);
    return analysis;

  } catch (error) {
    console.error('Error analyzing student answer:', error);

    // If there was an error but we have technical terms, use them for grading
    const technicalTerms = extractTechnicalTerms(studentAnswer);
    if (technicalTerms.length > 0) {
      // Calculate a score based on the number of technical terms (at least 30% of max points)
      const score = Math.ceil(maxPoints * Math.min(0.3 + (technicalTerms.length * 0.1), 0.7));

      console.log(`Using technical terms for fallback grading. Found ${technicalTerms.length} terms, score: ${score}/${maxPoints}`);

      return {
        conceptsPresent: technicalTerms,
        conceptsMissing: keyConcepts.filter(c => !technicalTerms.includes(c.toLowerCase())),
        score: score,
        technicalMerit: "Graded based on technical terminology used"
      };
    }

    // If no technical terms, fall back to keyword matching
    return fallbackKeywordGrading(studentAnswer, keyConcepts.join(' '), maxPoints, error);
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

    // Use a faster model for better performance and to avoid timeouts
    const model = geminiClient.getModel('gemini-1.5-flash');

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
const fallbackKeywordGrading = (studentAnswer, modelAnswer, maxPoints, error) => {
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

  // Calculate match percentage with a minimum score to avoid zero scores
  const matchPercentage = modelKeywords.length > 0
    ? Math.max(0.2, matchCount / modelKeywords.length) // Minimum 20% score
    : 0.2;

  // Assign score based on keyword match percentage
  const score = Math.round(matchPercentage * maxPoints);

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

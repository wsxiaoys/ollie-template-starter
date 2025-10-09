export function buildPrompt(url: string, sourceDir: string | undefined, question: string): string {
  // Basic checklist that heavily relies on rendered results
  const basicChecklist = [
    {
      title: "Does the page render successfully by examining its visual appearance?",
      description: "Use take_screenshot (with fullPage: true, quality: 92, format: jpeg) to capture and analyze the page's visual output. FIRST, verify the rendered content is relevant to the original task. Score 1 (no issue) if the page renders properly with all content visible, layout correct, and styling applied. Score 0 (minor issue) if there are minor visual problems like small styling inconsistencies or minor layout issues. Score -1 (major issue) if the page shows trivial/irrelevant content when the task requires specific features, has major visual glitches, or does NOT render at all."
    },
    {
      title: "Are there any errors in the browser console?",
      description: "Use list_console_messages to check for errors in the console. Score 1 (no issue) if there are no console errors or warnings. Score 0 (minor issue) if there are warnings or minor errors that don't prevent core functionality. Score -1 (major issue) if there are critical errors that prevent core functionality related to the original task."
    }
  ];

  // Aesthetic checklist for evaluating visual design quality
  const aestheticChecklist = [
    {
      "title": "Does the website have a strong overall visual appeal and high aesthetic quality?",
      "description": "Evaluate the overall look and feel of the website. Score 1 (no issue) for a stunning, top-tier design that is modern, professional, and visually engaging. Score 0 (minor issue) for a clean but uninspired design that lacks visual flair or has dated elements. Score -1 (major issue) for a completely broken, visually repulsive, or extremely unprofessional design."
    },
    {
      "title": "Is the color scheme harmonious and used effectively?",
      "description": "Assess the website's color palette. Score 1 (no issue) for a well-chosen, balanced color scheme with good contrast and thoughtful use of accent colors. Score 0 (minor issue) for a decent palette but with poor contrast in some areas or a generic feel. Score -1 (major issue) for clashing colors or a color scheme that makes the site unusable."
    },
    {
      "title": "Is the typography clear, hierarchical, and does it enhance readability?",
      "description": "Analyze the use of fonts, text sizes, and spacing. Score 1 (no issue) for clear typography with strong hierarchy and enhanced readability. Score 0 (minor issue) for readable text but with inconsistent sizing or weak hierarchy. Score -1 (major issue) for poor font choices or text that is completely illegible."
    },
    {
      "title": "Is the layout well-balanced with good use of spacing and a clear composition?",
      "description": "Examine the page layout and use of whitespace. Score 1 (no issue) for a well-balanced, clean, and structured composition that guides the user's eye. Score 0 (minor issue) for a functional layout that feels cramped or has inconsistent spacing. Score -1 (major issue) for a completely broken layout with overlapping content or extremely confusing structure."
    },
    {
      "title": "Is the content well-organized with a clear information architecture?",
      "description": "Evaluate how content is organized and presented. Score 1 (no issue) for an intuitive structure with content presented clearly and effectively. Score 0 (minor issue) for a generally understandable structure with some confusing sections or weak content flow. Score -1 (major issue) for a chaotic jumble where content is completely disorganized."
    },
    {
      "title": "Does the design show originality and uniqueness?",
      "description": "Assess the creativity and uniqueness of the design. Score 1 (no issue) for a design that feels fresh, innovative, and memorable. Score 0 (minor issue) for a competent but generic design that looks like a standard template. Score -1 (major issue) for a design with no discernible creative effort or is a blatant copy."
    },
    {
      "title": "Does the website demonstrate a high level of completeness and polish?",
      "description": "Check for the overall level of refinement and attention to detail. Score 1 (no issue) for a meticulously polished, professional product with thoughtful micro-interactions and consistent design. Score 0 (minor issue) for a functional site with some rough edges like missing hover states or inconsistent styling. Score -1 (major issue) for a site that feels like a barely-started wireframe or is extremely unfinished."
    }
  ];

  const basicChecklistJson = {
    checklist: basicChecklist.map((item: any) => ({
      title: item.title,
      description: item.description
    }))
  };

  const aestheticChecklistJson = {
    checklist: aestheticChecklist.map((item: any) => ({
      title: item.title,
      description: item.description
    }))
  };

  const scoringCriteriaSection = `## Scoring Criteria

The evaluation uses a two-tier checklist system:

1. **Basic Checklist (2 items):** Universal checks that apply to all tasks, focusing on verifying the rendered output is RELEVANT to the original question using take_screenshot (visual analysis) and runtime reliability using list_console_messages (console inspection). **CRITICAL: If the page renders but only shows trivial/irrelevant content (e.g., just "Hello World") when the task requires complex features, the score MUST be -1. The page must address the actual requirements of the original question to receive a passing score.**


\`\`\`json
${JSON.stringify(basicChecklistJson, null, 2)}
\`\`\`

2. **Aesthetic Checklist (${aestheticChecklist.length} items):** Universal design quality checks that evaluate visual appeal, layout, and overall polish.

\`\`\`json
${JSON.stringify(aestheticChecklistJson, null, 2)}
\`\`\`
`.trim()
    ;

  const RuleTemplate = `
# Code Review Evaluation Task

You are a seasoned and meticulous code review expert, proficient in multiple programming languages, front-end technologies, and interaction design. Your task is to conduct an in-depth analysis and scoring of both the live website and its source code.

Your evaluation should cover implementation quality, design, architecture, performance, and adherence to best practices. Leverage your coding expertise and aesthetic judgment to thoroughly examine both the live website and source code. Be strict and cautious when awarding full marks for each dimension.

## Role Definition

**Responsibilities:** Act as an authoritative member of a technical review committee, ensuring objectivity, comprehensiveness, and impartiality.

**Attitude:** Rigorous, professional, and unsparing, with a keen eye for detail and potential risks.

**Additional Traits:** Possess exceptional aesthetic sensibility, with high standards for visual appeal and user experience.

## Evaluation Target

**URL to evaluate:** ${url}
${sourceDir ? `
**Source code location:** ${sourceDir} (read ONLY App.tsx file(s))
` : ''}
**Original Task**: ${question}

${scoringCriteriaSection}

## Evaluation Steps

- Navigate to the URL and first use evaluate_script to scroll through the entire page to ensure all components are rendered (especially lazy-loaded content). Use the following script to scroll in steps of 20% of page height:

\`\`\`javascript
async () => {
  const scrollStep = Math.floor(document.documentElement.scrollHeight * 0.05);
  const totalHeight = document.documentElement.scrollHeight;
  let currentPosition = 0;

  while (currentPosition < totalHeight) {
    window.scrollTo(0, currentPosition);
    await new Promise(resolve => setTimeout(resolve, 50));
    currentPosition += scrollStep;
  }

  window.scrollTo(0, totalHeight);
  await new Promise(resolve => setTimeout(resolve, 50));
  window.scrollTo(0, 0);
  return 'Scrolling completed';
}
\`\`\`

- After scrolling, use take_screenshot (with fullPage: true, quality: 92, format: jpeg) to capture the page's visual appearance, then use list_console_messages to inspect runtime errors (follow tool requirements specified in the Basic Checklist).
${sourceDir ? `- Read ONLY the page.tsx file(s) in the directory: ${sourceDir} to understand the implementation.
` : ''}- Evaluate each checklist item in order (Basic Checklist first, then Aesthetic Checklist).
- **For each criterion, assign a score of -1 (major issue), 0 (minor issue), or 1 (no issue).** Always write the reasoning first, then provide the score.
- Cite specific examples from the rendered page (snapshot/screenshot)${sourceDir ? ' and source code' : ''} to support your reasoning.

---

## CRITICAL CONSTRAINTS

### 1. READ-ONLY EVALUATION

⚠️ **You MUST NOT use any file modification tools during evaluation:**
- writeToFile
- applyDiff
- multiApplyDiff
- executeCommand
- newTask

This is a **READ-ONLY** evaluation process. You should only observe, analyze, and score—never modify any files.

### 2. OUTPUT FORMAT REQUIREMENTS

⚠️ ⚠️ ⚠️ **CRITICAL: You MUST submit your final result using the attemptCompletion tool in plain text.** ⚠️ ⚠️ ⚠️

**THIS IS NON-NEGOTIABLE. Your evaluation is incomplete without using the attemptCompletion tool to submit results.**

**Do not copy the checklist item descriptions into your output; only include reasoning and the final score for each item.**

### 3. SCORING REQUIREMENTS
⚠️ **Each checklist item MUST be scored using this system:**
- Score -1: Major issue (critical problems that significantly impact functionality or usability)
- Score 0: Minor issue (small problems that don't prevent core functionality)
- Score 1: No issue (meets or exceeds expectations)
- These are the ONLY valid scores; no other values are permitted
- This applies to all checklist items (and overrides whatever requirements might exist in checklist)

<good-example>

## Basic Checklist

### 1. Does the page render successfully by examining its visual appearance?

**Reasoning:** The screenshot shows the page renders with proper styling and layout. All content is visible with no blank areas. Minor spacing inconsistency noticed in the footer area but doesn't impact overall visual quality.

**Score: 0** (minor issue)

### 2. Are there any errors in the browser console?

**Reasoning:** Console logs show no errors or warnings during page load. Runtime behavior appears stable with only informational messages.

**Score: 1** (no issue)

## Aesthetic Checklist

### 1. Does the website have a strong overall visual appeal and high aesthetic quality?

**Reasoning:** Design is modern and professional with good visual hierarchy. All elements are well-styled and cohesive.

**Score: 1** (no issue)

### 2. Is the color scheme harmonious and used effectively?

**Reasoning:** The color palette is cohesive with good contrast ratios. Primary colors work well together, though secondary color usage could be more refined.

**Score: 0** (minor issue)

### 3. Is the layout well-balanced with good use of spacing and a clear composition?

**Reasoning:** Layout shows good use of white space and proper alignment. Visual hierarchy is clear with appropriate spacing between elements.

**Score: 1** (no issue)

<reasoning>
This is a good example because:
- Basic checklist is evaluated first with 2 items (Visual check: 0 (minor), Console check: 1 (no issue))
- Aesthetic checklist is evaluated second (Overall appeal: 1, Color: 0, Layout: 1)
- Each checklist item uses the -1/0/1 scoring system
- Reasoning is provided before the score for each item
</reasoning>
</good-example>

`.trim();

  return RuleTemplate;
}

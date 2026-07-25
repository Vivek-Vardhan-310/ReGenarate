# Prompt Engineering Specification

**Project:** AI Code Review & Rewrite Agent

**Version:** 1.0

**Status:** Planning

**Owner:** Vivek Vardhan

---

# Related Documents

- 01-PRD.md
- 02-Architecture.md
- 03-Rules.md
- 07-API.md
- 10-Testing.md

---

# Table of Contents

1. Purpose
2. Prompt Engineering Philosophy
3. AI Communication Principles
4. Prompt Architecture
5. Prompt Lifecycle
6. Prompt Roles
7. Context Management
8. Token Optimization
9. Deterministic Prompting

---

# 1. Purpose

This document defines how the AI Code Review & Rewrite Agent constructs, manages, tests, and evolves prompts sent to large language models (LLMs).

Its goals are to:

- Produce consistent AI responses.
- Improve output quality.
- Reduce hallucinations.
- Optimize token usage.
- Enable prompt versioning.
- Support future AI providers without redesigning prompts.

Prompts should be treated as production assets rather than temporary strings embedded in source code.

---

# 2. Prompt Engineering Philosophy

Prompt engineering is the process of translating application requirements into clear, structured instructions that guide the language model toward predictable, high-quality outputs.

A prompt should behave like an API contract:

- Inputs are clearly defined.
- Expected outputs are specified.
- Ambiguity is minimized.
- Results remain consistent across repeated requests.

The prompt should communicate *what* the model should accomplish, *how* it should behave, and *what format* it should return.

---

# Core Principles

### Clarity

Instructions should be precise and unambiguous.

Avoid vague requests such as:

```
Improve this code.
```

Prefer:

```
Review the code for performance, readability, maintainability, and potential bugs. Return your findings in Markdown using the specified structure.
```

---

### Specificity

Every prompt should define:

- The task.
- The desired output.
- Formatting requirements.
- Constraints.
- Relevant context.

The model should never need to infer missing requirements.

---

### Consistency

Identical inputs should produce responses that are structurally similar.

Prompt templates should avoid unnecessary variation.

---

### Minimalism

Include only the information required to complete the task.

Unnecessary context increases latency, cost, and the risk of irrelevant output.

---

### Reusability

Prompt templates should be modular and parameterized rather than duplicated for each endpoint.

---

# 3. AI Communication Principles

The application communicates with the language model through structured prompts.

Every interaction should provide:

- Clear instructions.
- Necessary context.
- Expected output format.
- Explicit constraints.

The AI should never be expected to guess the application's requirements.

---

## Instruction Hierarchy

When constructing prompts, information should be ordered from highest to lowest priority.

```
System Instructions

↓

Task Instructions

↓

Formatting Requirements

↓

Context

↓

User Code

```

This ordering improves instruction adherence and readability.

---

## Constraint-Driven Prompting

Important constraints should be stated explicitly.

Examples

- Preserve functionality.
- Do not invent missing code.
- Return Markdown only.
- Return source code only.
- Avoid unnecessary explanations.

Constraints should be phrased positively where possible.

---

# 4. Prompt Architecture

Every prompt should follow a consistent structure.

```
System Role

↓

Task Definition

↓

Requirements

↓

Output Format

↓

Input Context

↓

User Code

```

Each section has a single purpose and should remain clearly separated.

---

# Prompt Components

### System Role

Defines the model's behavior.

Example responsibilities:

- Senior software engineer.
- Code reviewer.
- Refactoring specialist.

---

### Task

Defines the requested operation.

Examples

- Review source code.
- Rewrite implementation.
- Explain detected issues.

---

### Constraints

Examples

- Preserve behavior.
- Maintain language syntax.
- Avoid changing public APIs.
- Keep responses concise.

---

### Output Contract

Defines the exact structure expected from the model.

Examples

- Markdown sections.
- Bullet lists.
- Source code only.
- No introductory text.

---

### Context

Contains only information required to perform the task.

Examples

- Programming language.
- Review focus.
- Coding standards (future).

---

### User Input

Always appears as the final section of the prompt.

The user's source code should not be modified before insertion except for safe normalization (e.g., line endings).

---

# 5. Prompt Lifecycle

Every prompt follows a predictable lifecycle.

```
User Request

↓

Validate Input

↓

Load Template

↓

Substitute Variables

↓

Build Prompt

↓

Send to AI

↓

Receive Response

↓

Parse Output

↓

Return Result

```

Prompt construction should be deterministic and reproducible.

---

# 6. Prompt Roles

Prompt content should distinguish between different types of instructions.

---

## System Role

Defines the model's identity and permanent behavioral expectations.

Examples

- Experienced software engineer.
- Expert code reviewer.
- Refactoring assistant.

The system role should remain stable across requests.

---

## Task Instructions

Describe the specific operation to perform.

Examples

- Review this code.
- Rewrite this implementation.

Task instructions may vary between endpoints.

---

## Input Data

Contains runtime values.

Examples

- Programming language.
- Review focus.
- Source code.

Input data should never contain application instructions.

---

# 7. Context Management

The model should receive only the context required for the current request.

---

## Include

- Programming language.
- Source code.
- Review focus (if applicable).
- Output requirements.

---

## Exclude

- Previous conversations.
- Unrelated requests.
- Internal implementation details.
- Application logs.
- Sensitive configuration.

Context should be intentionally curated rather than accumulated.

---

# 8. Token Optimization

Reducing prompt size improves:

- Response latency.
- Operational cost.
- Model focus.

---

## Guidelines

- Remove redundant wording.
- Avoid repeating instructions.
- Avoid duplicate context.
- Keep templates concise.
- Send only necessary code.

Prompt templates should prioritize information density over verbosity.

---

## Large Source Files

For future versions, consider:

- Chunking.
- Summarization.
- Incremental review.
- File-by-file analysis.

Version 1 processes one code submission per request.

---

# 9. Deterministic Prompting

Prompt templates should produce predictable outputs for identical inputs.

---

## Recommendations

- Stable wording.
- Stable ordering.
- Stable formatting.
- Stable output contracts.

Avoid introducing random phrasing into templates.

Consistency simplifies parsing, testing, and future prompt optimization.

---

# End of Part 1

# 10. Prompt Template Strategy

## Purpose

Prompt templates provide reusable blueprints for communicating with the language model.

Instead of constructing prompts manually inside application code, the backend should populate predefined templates with runtime values.

Benefits include:

- Consistency
- Easier maintenance
- Version control
- Better testing
- Provider independence

Each prompt template should represent one well-defined task.

---

# Template Structure

Every prompt should follow the same high-level structure.

```
System Role

↓

Task Description

↓

Requirements

↓

Output Contract

↓

Runtime Context

↓

User Code
```

The ordering should remain consistent across all templates.

---

# 11. Variable Substitution

Prompt templates contain placeholders that are replaced during request processing.

---

## Supported Variables

| Variable | Description |
|----------|-------------|
| `{{language}}` | Programming language |
| `{{review_focus}}` | Requested review category |
| `{{code}}` | User-submitted source code |
| `{{max_response_length}}` | Optional future response limit |
| `{{project_rules}}` | Future coding standards |

Variables should be escaped or inserted safely to preserve the original source code.

---

# Example

Template

```
Language:
{{language}}

Review Focus:
{{review_focus}}

Code:

{{code}}
```

After substitution

```
Language:
Java

Review Focus:
Performance

Code:

public class Example {
}
```

---

# 12. System Prompt

## Purpose

The system prompt defines the model's permanent behavior.

It should remain stable across requests and should not include runtime values.

---

## Recommended System Prompt

```
You are an experienced senior software engineer specializing in software architecture, code quality, performance, maintainability, security, and best practices.

Your responsibilities are to review and improve source code while preserving its intended functionality.

Follow the requested output format exactly.

Do not fabricate missing requirements.

Do not introduce unnecessary complexity.

If assumptions are required, state them clearly.

Prioritize correctness, clarity, and maintainability.
```

---

## System Prompt Rules

The system prompt should:

- Be concise.
- Define behavior rather than individual tasks.
- Avoid endpoint-specific wording.
- Remain version-controlled.

---

# 13. Review Prompt Template

## Purpose

Generates a structured Markdown review of the submitted code.

---

## Template

```
Task

Review the following {{language}} source code.

Focus primarily on:

{{review_focus}}

Your review should evaluate:

- Correctness
- Readability
- Maintainability
- Performance (when applicable)
- Security (when applicable)
- Best practices
- Potential bugs

Provide practical and actionable suggestions.

Do not rewrite the entire implementation.

---

Output Requirements

Return Markdown only.

Use exactly the following structure.

# Summary

# Strengths

# Issues

# Recommendations

# Example Improvements

---

Source Code

{{code}}
```

---

## Expected Output

```
# Summary

...

# Strengths

...

# Issues

...

# Recommendations

...

# Example Improvements

...
```

A predictable structure simplifies rendering and future automation.

---

# 14. Rewrite Prompt Template

## Purpose

Generates an improved implementation while preserving functionality.

---

## Template

```
Task

Rewrite the following {{language}} source code.

Requirements

Preserve behavior.

Improve:

- Readability
- Maintainability
- Performance where appropriate
- Naming
- Structure

Avoid unnecessary complexity.

Do not change external behavior unless correcting an obvious defect.

---

Output Requirements

Return only the rewritten source code.

Do not include Markdown.

Do not include explanations.

Do not include comments outside the source code.

---

Source Code

{{code}}
```

---

## Expected Output

```
public class Example {

    ...

}
```

The response should contain source code only.

---

# 15. Output Contracts

The Prompt Builder must instruct the model to return outputs in formats that the application can process reliably.

---

## Review Contract

Requirements

- Markdown only.
- No introductory text.
- No closing remarks.
- Standard section headings.
- Consistent formatting.

---

## Rewrite Contract

Requirements

- Source code only.
- Preserve indentation.
- Preserve language syntax.
- No Markdown fences.
- No explanations.

---

## Why Output Contracts Matter

Consistent outputs:

- Simplify parsing.
- Reduce post-processing.
- Improve frontend rendering.
- Reduce implementation complexity.

---

# 16. Formatting Rules

## Markdown Review

Use:

- Headings
- Bullet lists
- Inline code
- Code blocks only when necessary

Avoid excessive nesting or decorative formatting.

---

## Source Code

The rewrite output should:

- Preserve indentation.
- Preserve line breaks.
- Use conventional formatting for the language.
- Avoid unnecessary whitespace changes.

---

# 17. Prompt Examples

## Example Review Request

```
Language:
Python

Review Focus:
Security

Source Code:

def login(password):
    if password == "admin":
        print("Access")
```

Expected output

```
# Summary

...

# Strengths

...

# Issues

...

# Recommendations

...
```

---

## Example Rewrite Request

```
Language:
Python

Source Code:

for i in range(0,len(items)):
    print(items[i])
```

Expected output

```
for item in items:
    print(item)
```

---

# 18. Prompt Construction Rules

Before a prompt is sent to the AI, verify:

- Required variables exist.
- No unresolved placeholders remain.
- The correct template is selected.
- The output contract matches the endpoint.
- Runtime values are inserted in the proper locations.

Prompt construction should fail fast if template generation is incomplete.

---

# End of Part 2

# 19. Prompt Management

## Purpose

Prompt management defines how prompt templates are organized, maintained, tested, and improved throughout the application's lifecycle.

Prompt templates should be treated as production assets, similar to source code.

Every prompt should be:

- Version-controlled
- Documented
- Reviewed
- Tested
- Easily replaceable

---

# Prompt Organization

Prompt templates should be stored separately from business logic.

Example

```
backend/

prompts/
│
├── system_prompt.md
├── review_prompt.md
├── rewrite_prompt.md
│
├── templates/
│   ├── review.md
│   └── rewrite.md
│
└── versions/
    ├── v1/
    └── v2/
```

Prompt text should never be hardcoded directly inside controllers or services.

---

# Loading Strategy

```
Application Starts

↓

Load Prompt Templates

↓

Validate Templates

↓

Cache Templates

↓

Use During Requests
```

Templates should be loaded once during startup whenever practical.

---

# 20. Prompt Versioning

Prompt quality improves over time.

Versioning allows improvements without losing previous behavior.

---

## Version Format

```
1.0

1.1

2.0
```

---

## Major Versions

Examples

- New prompt architecture
- Different output format
- Significant behavior changes

---

## Minor Versions

Examples

- Better wording
- Improved instructions
- Better formatting
- Stronger constraints

---

## Patch Versions

Examples

- Grammar corrections
- Documentation improvements
- Minor clarification

---

# Version Metadata

Every template should include metadata.

Example

```
Prompt Name

Version

Author

Last Updated

Purpose

Compatible Models

```

---

# 21. Prompt Testing

Every prompt change should be tested before release.

---

## Objectives

Verify that prompts:

- Produce correct output.
- Follow formatting rules.
- Avoid regressions.
- Improve quality.
- Remain deterministic.

---

## Test Inputs

Maintain a library of representative examples.

Examples

- Small programs
- Large files
- Poorly formatted code
- High-quality code
- Empty input
- Invalid language

The same test cases should be reused after every prompt modification.

---

## Expected Results

Each test should verify:

- Output format
- Structural consistency
- Correctness
- Readability
- Actionability

---

# Regression Testing

Prompt improvements should not unintentionally reduce response quality.

Every prompt update should be compared against previous versions using identical inputs.

---

# 22. Prompt Evaluation Metrics

Prompt quality should be measured objectively whenever possible.

---

## Suggested Metrics

| Metric | Description |
|---------|-------------|
| Instruction Following | Model follows requested task |
| Output Consistency | Stable structure across runs |
| Markdown Quality | Correct formatting |
| Code Correctness | Valid rewritten code |
| Hallucination Rate | Unsupported claims |
| Token Usage | Prompt + response size |
| Latency | Response generation time |

Metrics should be collected over multiple test cases rather than single examples.

---

## Human Evaluation

Some qualities require manual review.

Examples

- Clarity
- Usefulness
- Practical recommendations
- Readability
- Maintainability

Human evaluation should complement automated testing.

---

# 23. Hallucination Reduction

Language models may generate information that is unsupported by the provided code.

Prompt design should minimize this behavior.

---

## Strategies

Explicitly instruct the model to:

- Base conclusions only on the submitted code.
- State assumptions clearly.
- Avoid inventing missing implementation details.
- Avoid guessing project requirements.

---

## Example Constraint

```
If the provided code does not contain enough information to reach a conclusion, explain the limitation rather than making assumptions.
```

---

# 24. Prompt Guardrails

Guardrails define behaviors that the model should avoid.

---

## Review Prompt

Do not:

- Rewrite the entire program.
- Invent additional requirements.
- Criticize style without justification.
- Repeat identical recommendations.

---

## Rewrite Prompt

Do not:

- Change public behavior unnecessarily.
- Introduce unrelated features.
- Add external dependencies.
- Remove required functionality.
- Return explanations instead of code.

---

## General

Avoid:

- Personal opinions.
- Speculation.
- Excessively verbose responses.
- Unstructured output.

---

# 25. Model Adaptation Strategy

Version 1 targets Groq-hosted models.

Future versions may support multiple providers.

Prompt templates should remain largely provider-independent.

---

## Model-Specific Adjustments

Only provider-specific behavior should vary.

Examples

- Maximum context length
- Temperature
- Token limits
- Response parameters

Task instructions should remain consistent across providers.

---

## Provider Abstraction

```
Application

↓

Prompt Builder

↓

Prompt Template

↓

AI Provider

↓

Model
```

Changing providers should not require rewriting templates.

---

# 26. Prompt Performance

Prompt quality is not measured only by output quality.

Performance is also important.

---

## Goals

- Low latency
- Low token usage
- High consistency
- Reliable formatting

Avoid adding instructions that do not measurably improve results.

---

## Optimization Process

```
Measure

↓

Analyze

↓

Modify Prompt

↓

Retest

↓

Compare

↓

Deploy
```

Optimization should be driven by evidence rather than intuition.

---

# 27. Prompt Review Checklist

Before approving a prompt change, verify:

### Structure

- [ ] Correct template selected.
- [ ] Required sections included.
- [ ] Variables correctly placed.

---

### Quality

- [ ] Instructions are clear.
- [ ] Constraints are explicit.
- [ ] Output contract defined.

---

### Safety

- [ ] No hidden assumptions.
- [ ] Hallucination risk minimized.
- [ ] Sensitive data excluded.

---

### Performance

- [ ] No redundant wording.
- [ ] Token usage reasonable.
- [ ] Prompt remains concise.

---

### Compatibility

- [ ] Existing parser still functions.
- [ ] Existing frontend still compatible.
- [ ] Previous tests still pass.

---

# 28. Prompt Design Principles Recap

Every production prompt should be:

- Clear
- Concise
- Deterministic
- Reusable
- Testable
- Versioned
- Provider-independent
- Easy to maintain

Prompt quality should improve through measurement and controlled iteration rather than ad hoc experimentation.

---

# End of Part 3

# 29. Prompt Governance

## Purpose

Prompt governance establishes the policies for creating, reviewing, modifying, and maintaining prompt templates throughout the project's lifecycle.

Prompt templates directly influence application behavior and should therefore follow the same engineering discipline as source code.

Every prompt modification should be:

- Planned
- Reviewed
- Tested
- Documented
- Version-controlled

---

# Governance Principles

Prompt engineering should prioritize:

- Consistency
- Maintainability
- Predictability
- Transparency
- Measurable improvement

Prompt changes should solve identified problems rather than introduce unnecessary experimentation.

---

# 30. Prompt Change Workflow

Every prompt modification should follow a defined lifecycle.

```
Identify Improvement

↓

Propose Change

↓

Review Design

↓

Implement

↓

Test

↓

Evaluate

↓

Update Documentation

↓

Approve

↓

Release
```

Skipping testing or documentation should not be permitted.

---

## Change Categories

### Patch

Examples

- Grammar corrections
- Clarified wording
- Documentation updates

---

### Minor

Examples

- Better formatting
- Improved instructions
- Reduced token usage
- Stronger constraints

---

### Major

Examples

- New prompt architecture
- Different response structure
- New parsing strategy
- Major behavioral changes

Major changes should include a migration plan.

---

# 31. Documentation Standards

Every prompt template should include metadata.

Example

```
Prompt Name

Version

Purpose

Author

Last Updated

Compatible Models

Required Variables

Expected Output

Known Limitations
```

Prompt documentation should evolve alongside the templates.

---

## Prompt Comments

If prompt files support comments or metadata sections, document:

- Design rationale
- Important constraints
- Parser expectations
- Version history

Avoid embedding implementation details inside the prompt itself.

---

# 32. Experimentation Policy

Prompt improvements should be evidence-based.

---

## Controlled Experiments

When testing a new prompt:

- Use the same input dataset.
- Compare outputs against the current version.
- Measure objective metrics.
- Perform manual review.
- Record findings.

Avoid evaluating prompts using only a single example.

---

## A/B Testing (Future)

Future versions may compare prompt variants.

Example

```
Prompt A

↓

100 Requests

↓

Evaluation

```

```
Prompt B

↓

100 Requests

↓

Evaluation
```

Selection should be based on measured quality rather than preference.

---

# 33. Structured Output Strategy

Version 1 primarily relies on Markdown and plain source code outputs.

Future versions may adopt structured outputs where supported.

Examples

- JSON objects
- XML
- YAML
- Tool-calling responses
- Function calling
- Schema-constrained generation

Structured outputs can reduce parsing complexity and improve reliability.

---

## Transition Guidelines

When adopting structured outputs:

- Maintain backward compatibility where possible.
- Update parsers.
- Update API documentation.
- Update automated tests.

---

# 34. Multi-Model Strategy

The application should support multiple language models without redesigning prompt templates.

---

## Supported Models (Future)

Examples

- Groq-hosted models
- OpenAI
- Anthropic
- Gemini
- Ollama
- Azure OpenAI

---

## Adaptation Policy

Provider-specific differences should remain isolated to:

- Model configuration
- Temperature
- Maximum tokens
- Context window
- API parameters

Task instructions should remain provider-independent whenever possible.

---

# 35. AI Capability Roadmap

Prompt templates should evolve as model capabilities improve.

---

## Version 1

- Code review
- Code rewriting

---

## Version 2

Potential additions

- Code explanation
- Unit test generation
- Documentation generation
- Complexity analysis

---

## Version 3

Potential additions

- Repository-wide review
- Multi-file reasoning
- Architecture recommendations
- Dependency analysis
- Interactive review sessions

Future capabilities should build upon existing prompt engineering principles rather than replace them.

---

# 36. Prompt Ownership

Prompt templates require clear ownership.

---

## Responsibilities

Owners should:

- Review proposed changes.
- Maintain documentation.
- Evaluate quality.
- Approve releases.
- Monitor regressions.

Clear ownership reduces inconsistency and improves accountability.

---

# 37. Prompt Maintenance Schedule

Prompt templates should be reviewed periodically.

Suggested review triggers:

- Model upgrades
- Provider changes
- Parser updates
- User feedback
- Regression reports
- Performance issues

Routine reviews help ensure prompts remain effective as the surrounding system evolves.

---

# 38. Prompt Engineering Checklist

Before approving a prompt for production, verify:

### Design

- [ ] Single purpose.
- [ ] Clear instructions.
- [ ] Explicit constraints.

---

### Variables

- [ ] All placeholders documented.
- [ ] No unresolved variables.
- [ ] Safe substitution.

---

### Output

- [ ] Output contract defined.
- [ ] Parser compatibility verified.
- [ ] Formatting consistent.

---

### Quality

- [ ] Tested against representative inputs.
- [ ] Hallucination risk evaluated.
- [ ] Regression tests passed.

---

### Documentation

- [ ] Metadata updated.
- [ ] Version incremented.
- [ ] Related documents updated.

---

### Governance

- [ ] Change reviewed.
- [ ] Approval recorded.
- [ ] Release notes prepared.

---

# 39. Prompt Engineering Principles Recap

Every production prompt should strive to be:

- Clear
- Specific
- Deterministic
- Context-aware
- Concise
- Reusable
- Testable
- Version-controlled
- Provider-independent

Prompt quality should improve through structured iteration supported by testing and measurement.

---

# 40. Final Summary

This document defines the prompt engineering strategy for the AI Code Review & Rewrite Agent.

It establishes a consistent approach to prompt design, template organization, output contracts, testing, versioning, governance, and future evolution.

By treating prompts as first-class engineering assets rather than embedded strings, the project improves output consistency, simplifies maintenance, reduces regressions, and enables support for multiple AI providers without major architectural changes.

These practices create a strong foundation for reliable AI-assisted code review today while preparing the project for future capabilities such as structured outputs, tool calling, repository-wide analysis, and collaborative AI workflows.

---

## Related Documents

- 01-PRD.md
- 02-Architecture.md
- 03-Rules.md
- 04-Phases.md
- 05-Design.md
- 06-Memory.md
- 07-API.md
- 10-Testing.md

---

**Document Status:** Approved

**Prompt Version:** 1.0

**Governance Status:** Active
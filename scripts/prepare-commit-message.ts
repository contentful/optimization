import { input } from '@commitlint/prompt/lib/input.js'
import InputCustomPrompt from '@commitlint/prompt/lib/inquirer/InputCustomPrompt.js'
import type { Answers, DistinctQuestion, PromptModule, QuestionCollection } from 'inquirer'
import inquirer from 'inquirer'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import type { Key } from 'node:readline'

const JIRA_BASE_URL = 'https://contentful.atlassian.net/browse'
const JIRA_FOOTER_REGEX =
  /^\[\[[A-Z][A-Z0-9]+-\d+\]\(https:\/\/contentful\.atlassian\.net\/browse\/[A-Z][A-Z0-9]+-\d+\)\]$/imu
const JIRA_TICKET_REGEX = /(^|[^A-Z0-9])([A-Z][A-Z0-9]+-\d+)(?=$|[^A-Z0-9])/iu

async function main(): Promise<void> {
  const [commandOrMessagePath] = process.argv.slice(2)

  if (commandOrMessagePath === 'self-check') {
    runSelfCheck()
    process.stdout.write('prepare-commit-message self-check passed.\n')
    return
  }

  if (commandOrMessagePath === '--commit') {
    ensureStagedChanges()
    commit(await readCommitMessage())
    return
  }

  if (commandOrMessagePath === undefined) {
    fail('Usage: tsx scripts/prepare-commit-message.ts <commit-message-file>|--commit|self-check')
  }

  writeFileSync(commandOrMessagePath, `${await readCommitMessage()}\n`)
}

async function readCommitMessage(): Promise<string> {
  const message = addJiraFooter(await input(promptWithoutFooter), readCurrentBranch())

  if (message.trim() === '') {
    fail('Commit message prompt returned an empty message.')
  }

  return message
}

const promptWithoutFooter = createPromptWithoutFooter()

function createPromptWithoutFooter(): PromptModule {
  const prompt = async <T extends Answers = Answers>(
    questions: QuestionCollection<T>,
    initialAnswers?: Partial<T>,
  ): Promise<T> => await inquirer.prompt(filterFooterQuestion(questions), initialAnswers)

  const wrappedPrompt = Object.assign(prompt, {
    prompts: inquirer.prompt.prompts,
    registerPrompt(...args: Parameters<PromptModule['registerPrompt']>) {
      const [name, promptConstructor] = args
      inquirer.prompt.registerPrompt(
        name,
        name === 'input-custom' ? SelectableInputPrompt : promptConstructor,
      )
      return wrappedPrompt
    },
    restoreDefaultPrompts() {
      inquirer.prompt.restoreDefaultPrompts()
    },
  })

  return wrappedPrompt
}

function filterFooterQuestion<T extends Answers>(
  questions: QuestionCollection<T>,
): QuestionCollection<T> {
  if (!Array.isArray(questions)) {
    return questions
  }

  const questionList = questions as ReadonlyArray<DistinctQuestion<T>>

  return questionList.filter((question) => question.name !== 'footer')
}

interface KeyDescriptor {
  key: Key
  value: string
}

interface SelectableInputQuestion extends DistinctQuestion {
  tabCompletion?: Array<{ value: string }>
}

class SelectableInputPrompt extends InputCustomPrompt<SelectableInputQuestion> {
  private readonly choices: string[]
  private selectedIndex = -1

  constructor(...args: ConstructorParameters<typeof InputCustomPrompt<SelectableInputQuestion>>) {
    super(...args)
    this.choices = readTabCompletionValues(args[0])
  }

  override onKeyPress2(event: KeyDescriptor): void {
    if (event.key.name === 'up') {
      this.selectChoice(-1)
      return
    }

    if (event.key.name === 'down') {
      this.selectChoice(1)
      return
    }

    super.onKeyPress2(event)
  }

  override render(error?: string): void {
    const answered = this.status === 'answered'
    let message = this.getQuestion()

    if (answered) {
      message += String(this.answer)
    } else {
      message += this.rl.line
    }

    const bottomContent = (error === undefined ? this.renderChoices() : `>> ${error}`) ?? ''

    this.screen.render(message, bottomContent)
  }

  private selectChoice(delta: number): void {
    if (this.choices.length === 0) {
      return
    }

    const lineIndex = this.choices.indexOf(this.rl.line.trim())
    const baseIndex = lineIndex === -1 ? this.selectedIndex : lineIndex
    this.selectedIndex = getNextChoiceIndex(baseIndex, delta, this.choices.length)

    const selectedChoice = this.choices.at(this.selectedIndex)

    if (selectedChoice !== undefined) {
      const { length } = selectedChoice
      this.rl.line = selectedChoice
      this.rl.cursor = length
    }

    this.render()
  }

  private renderChoices(): string | undefined {
    if (this.choices.length === 0 || this.status === 'answered') {
      return undefined
    }

    const lineIndex = this.choices.indexOf(this.rl.line.trim())
    const selectedIndex = lineIndex === -1 ? this.selectedIndex : lineIndex

    return this.choices
      .map((choice, index) => `${index === selectedIndex ? '>' : ' '} ${choice}`)
      .join('\n')
  }
}

function readTabCompletionValues(question: SelectableInputQuestion): string[] {
  return question.tabCompletion?.map((choice) => choice.value) ?? []
}

function getNextChoiceIndex(currentIndex: number, delta: number, length: number): number {
  if (currentIndex === -1) {
    return delta > 0 ? 0 : length - 1
  }

  return wrapIndex(currentIndex + delta, length)
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length
}

function addJiraFooter(message: string, branchName: string | undefined): string {
  const ticket = getJiraTicket(branchName)

  if (ticket === undefined || JIRA_FOOTER_REGEX.test(message)) {
    return message
  }

  return `${message.trimEnd()}\n\n[[${ticket}](${JIRA_BASE_URL}/${ticket})]`
}

function getJiraTicket(branchName: string | undefined): string | undefined {
  const match = branchName?.match(JIRA_TICKET_REGEX)
  const [, , ticket] = match ?? []
  return ticket?.toUpperCase()
}

function readCurrentBranch(): string | undefined {
  const result = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' })

  if (result.status !== 0) {
    return undefined
  }

  return result.stdout.trim()
}

function ensureStagedChanges(): void {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'])

  if (result.status === 0) {
    fail('Nothing to commit. Stage your changes via "git add" and run "pnpm commit" again.')
  }

  if (result.status !== 1) {
    fail('Failed to inspect staged changes.')
  }
}

function commit(message: string): void {
  const result = spawnSync('git', ['commit', '-m', message], { stdio: 'inherit' })

  if (result.error !== undefined) {
    fail(result.error.message)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runSelfCheck(): void {
  const choiceCount = 3

  assert.equal(typeof promptWithoutFooter, 'function')
  assert.equal(getJiraTicket('NT-3524_semantic-versioning-continuous-deployment'), 'NT-3524')
  assert.equal(getJiraTicket('feature/nt-3524-semantic-versioning'), 'NT-3524')
  assert.equal(getJiraTicket('semantic-versioning'), undefined)
  assert.deepEqual(filterFooterQuestion([{ name: 'type' }, { name: 'footer' }]), [{ name: 'type' }])
  assert.equal(getNextChoiceIndex(-1, 1, choiceCount), 0)
  assert.equal(getNextChoiceIndex(-1, -1, choiceCount), choiceCount - 1)
  assert.equal(getNextChoiceIndex(choiceCount - 1, 1, choiceCount), 0)
  assert.equal(
    addJiraFooter('feat(repo): add release flow', 'NT-3524-release'),
    `feat(repo): add release flow\n\n[[NT-3524](${JIRA_BASE_URL}/NT-3524)]`,
  )
  assert.equal(
    addJiraFooter(`feat(repo): add release flow\n\n[[NT-1](${JIRA_BASE_URL}/NT-1)]`, 'NT-3524'),
    `feat(repo): add release flow\n\n[[NT-1](${JIRA_BASE_URL}/NT-1)]`,
  )
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  fail(message)
})

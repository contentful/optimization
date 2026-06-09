import { Injectable } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly subject = new BehaviorSubject<boolean>(false)
  readonly globalLiveUpdates$ = this.subject.asObservable()
  readonly globalLiveUpdates = toSignal(this.subject, { initialValue: false })

  toggle(): void {
    this.subject.next(!this.subject.value)
  }
}

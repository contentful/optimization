!(function (e, t) {
  'object' == typeof exports && 'object' == typeof module
    ? (module.exports = t())
    : 'function' == typeof define && define.amd
      ? define([], t)
      : 'object' == typeof exports
        ? (exports.OptimizationBridge = t())
        : (e.OptimizationBridge = t())
})(globalThis, () =>
  (() => {
    'use strict'
    let e, t, n, i, r, o, s
    var a,
      l,
      u,
      c,
      d,
      f,
      p,
      h,
      v,
      y,
      g,
      m,
      b = {}
    ;((b.d = (e, t) => {
      for (var n in t)
        b.o(t, n) && !b.o(e, n) && Object.defineProperty(e, n, { enumerable: !0, get: t[n] })
    }),
      (b.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)))
    var w = {}
    b.d(w, { default: () => rE })
    var _ = Symbol.for('preact-signals')
    function z() {
      if (P > 1) P--
      else {
        for (var e, t = !1; void 0 !== E; ) {
          var n = E
          for (E = void 0, x++; void 0 !== n; ) {
            var i = n.o
            if (((n.o = void 0), (n.f &= -3), !(8 & n.f) && B(n)))
              try {
                n.c()
              } catch (n) {
                t || ((e = n), (t = !0))
              }
            n = i
          }
        }
        if (((x = 0), P--, t)) throw e
      }
    }
    function k(e) {
      if (P > 0) return e()
      P++
      try {
        return e()
      } finally {
        z()
      }
    }
    var O = void 0
    function S(e) {
      var t = O
      O = void 0
      try {
        return e()
      } finally {
        O = t
      }
    }
    var $,
      E = void 0,
      P = 0,
      x = 0,
      j = 0
    function I(e) {
      if (void 0 !== O) {
        var t = e.n
        if (void 0 === t || t.t !== O)
          return (
            (t = { i: 0, S: e, p: O.s, n: void 0, t: O, e: void 0, x: void 0, r: t }),
            void 0 !== O.s && (O.s.n = t),
            (O.s = t),
            (e.n = t),
            32 & O.f && e.S(t),
            t
          )
        if (-1 === t.i)
          return (
            (t.i = 0),
            void 0 !== t.n &&
              ((t.n.p = t.p),
              void 0 !== t.p && (t.p.n = t.n),
              (t.p = O.s),
              (t.n = void 0),
              (O.s.n = t),
              (O.s = t)),
            t
          )
      }
    }
    function T(e, t) {
      ;((this.v = e),
        (this.i = 0),
        (this.n = void 0),
        (this.t = void 0),
        (this.W = null == t ? void 0 : t.watched),
        (this.Z = null == t ? void 0 : t.unwatched),
        (this.name = null == t ? void 0 : t.name))
    }
    function A(e, t) {
      return new T(e, t)
    }
    function B(e) {
      for (var t = e.s; void 0 !== t; t = t.n)
        if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0
      return !1
    }
    function F(e) {
      for (var t = e.s; void 0 !== t; t = t.n) {
        var n = t.S.n
        if ((void 0 !== n && (t.r = n), (t.S.n = t), (t.i = -1), void 0 === t.n)) {
          e.s = t
          break
        }
      }
    }
    function C(e) {
      for (var t = e.s, n = void 0; void 0 !== t; ) {
        var i = t.p
        ;(-1 === t.i
          ? (t.S.U(t), void 0 !== i && (i.n = t.n), void 0 !== t.n && (t.n.p = i))
          : (n = t),
          (t.S.n = t.r),
          void 0 !== t.r && (t.r = void 0),
          (t = i))
      }
      e.s = n
    }
    function R(e, t) {
      ;(T.call(this, void 0),
        (this.x = e),
        (this.s = void 0),
        (this.g = j - 1),
        (this.f = 4),
        (this.W = null == t ? void 0 : t.watched),
        (this.Z = null == t ? void 0 : t.unwatched),
        (this.name = null == t ? void 0 : t.name))
    }
    function q(e, t) {
      return new R(e, t)
    }
    function M(e) {
      var t = e.u
      if (((e.u = void 0), 'function' == typeof t)) {
        P++
        var n = O
        O = void 0
        try {
          t()
        } catch (t) {
          throw ((e.f &= -2), (e.f |= 8), U(e), t)
        } finally {
          ;((O = n), z())
        }
      }
    }
    function U(e) {
      for (var t = e.s; void 0 !== t; t = t.n) t.S.U(t)
      ;((e.x = void 0), (e.s = void 0), M(e))
    }
    function V(e) {
      if (O !== this) throw Error('Out-of-order effect')
      ;(C(this), (O = e), (this.f &= -2), 8 & this.f && U(this), z())
    }
    function Z(e, t) {
      ;((this.x = e),
        (this.u = void 0),
        (this.s = void 0),
        (this.o = void 0),
        (this.f = 32),
        (this.name = null == t ? void 0 : t.name),
        $ && $.push(this))
    }
    function D(e, t) {
      var n = new Z(e, t)
      try {
        n.c()
      } catch (e) {
        throw (n.d(), e)
      }
      var i = n.d.bind(n)
      return ((i[Symbol.dispose] = i), i)
    }
    function N(e) {
      return Object.getOwnPropertySymbols(e).filter((t) =>
        Object.prototype.propertyIsEnumerable.call(e, t),
      )
    }
    function L(e) {
      return null == e
        ? void 0 === e
          ? '[object Undefined]'
          : '[object Null]'
        : Object.prototype.toString.call(e)
    }
    ;((T.prototype.brand = _),
      (T.prototype.h = function () {
        return !0
      }),
      (T.prototype.S = function (e) {
        var t = this,
          n = this.t
        n !== e &&
          void 0 === e.e &&
          ((e.x = n),
          (this.t = e),
          void 0 !== n
            ? (n.e = e)
            : S(function () {
                var e
                null == (e = t.W) || e.call(t)
              }))
      }),
      (T.prototype.U = function (e) {
        var t = this
        if (void 0 !== this.t) {
          var n = e.e,
            i = e.x
          ;(void 0 !== n && ((n.x = i), (e.e = void 0)),
            void 0 !== i && ((i.e = n), (e.x = void 0)),
            e === this.t &&
              ((this.t = i),
              void 0 === i &&
                S(function () {
                  var e
                  null == (e = t.Z) || e.call(t)
                })))
        }
      }),
      (T.prototype.subscribe = function (e) {
        var t = this
        return D(
          function () {
            var n = t.value,
              i = O
            O = void 0
            try {
              e(n)
            } finally {
              O = i
            }
          },
          { name: 'sub' },
        )
      }),
      (T.prototype.valueOf = function () {
        return this.value
      }),
      (T.prototype.toString = function () {
        return this.value + ''
      }),
      (T.prototype.toJSON = function () {
        return this.value
      }),
      (T.prototype.peek = function () {
        var e = O
        O = void 0
        try {
          return this.value
        } finally {
          O = e
        }
      }),
      Object.defineProperty(T.prototype, 'value', {
        get: function () {
          var e = I(this)
          return (void 0 !== e && (e.i = this.i), this.v)
        },
        set: function (e) {
          if (e !== this.v) {
            if (x > 100) throw Error('Cycle detected')
            ;((this.v = e), this.i++, j++, P++)
            try {
              for (var t = this.t; void 0 !== t; t = t.x) t.t.N()
            } finally {
              z()
            }
          }
        },
      }),
      (R.prototype = new T()),
      (R.prototype.h = function () {
        if (((this.f &= -3), 1 & this.f)) return !1
        if (32 == (36 & this.f) || ((this.f &= -5), this.g === j)) return !0
        if (((this.g = j), (this.f |= 1), this.i > 0 && !B(this))) return ((this.f &= -2), !0)
        var e = O
        try {
          ;(F(this), (O = this))
          var t = this.x()
          ;(16 & this.f || this.v !== t || 0 === this.i) &&
            ((this.v = t), (this.f &= -17), this.i++)
        } catch (e) {
          ;((this.v = e), (this.f |= 16), this.i++)
        }
        return ((O = e), C(this), (this.f &= -2), !0)
      }),
      (R.prototype.S = function (e) {
        if (void 0 === this.t) {
          this.f |= 36
          for (var t = this.s; void 0 !== t; t = t.n) t.S.S(t)
        }
        T.prototype.S.call(this, e)
      }),
      (R.prototype.U = function (e) {
        if (void 0 !== this.t && (T.prototype.U.call(this, e), void 0 === this.t)) {
          this.f &= -33
          for (var t = this.s; void 0 !== t; t = t.n) t.S.U(t)
        }
      }),
      (R.prototype.N = function () {
        if (!(2 & this.f)) {
          this.f |= 6
          for (var e = this.t; void 0 !== e; e = e.x) e.t.N()
        }
      }),
      Object.defineProperty(R.prototype, 'value', {
        get: function () {
          if (1 & this.f) throw Error('Cycle detected')
          var e = I(this)
          if ((this.h(), void 0 !== e && (e.i = this.i), 16 & this.f)) throw this.v
          return this.v
        },
      }),
      (Z.prototype.c = function () {
        var e = this.S()
        try {
          if (8 & this.f || void 0 === this.x) return
          var t = this.x()
          'function' == typeof t && (this.u = t)
        } finally {
          e()
        }
      }),
      (Z.prototype.S = function () {
        if (1 & this.f) throw Error('Cycle detected')
        ;((this.f |= 1), (this.f &= -9), M(this), F(this), P++)
        var e = O
        return ((O = this), V.bind(this, e))
      }),
      (Z.prototype.N = function () {
        2 & this.f || ((this.f |= 2), (this.o = E), (E = this))
      }),
      (Z.prototype.d = function () {
        ;((this.f |= 8), 1 & this.f || U(this))
      }),
      (Z.prototype.dispose = function () {
        this.d()
      }))
    let Q = '[object RegExp]',
      H = '[object String]',
      J = '[object Number]',
      W = '[object Boolean]',
      K = '[object Arguments]',
      G = '[object Symbol]',
      X = '[object Date]',
      Y = '[object Map]',
      ee = '[object Set]',
      et = '[object Array]',
      en = '[object ArrayBuffer]',
      ei = '[object Object]',
      er = '[object DataView]',
      eo = '[object Uint8Array]',
      es = '[object Uint8ClampedArray]',
      ea = '[object Uint16Array]',
      el = '[object Uint32Array]',
      eu = '[object Int8Array]',
      ec = '[object Int16Array]',
      ed = '[object Int32Array]',
      ef = '[object Float32Array]',
      ep = '[object Float64Array]'
    function eh(e, t, n, i = new Map(), r) {
      let o = r?.(e, t, n, i)
      if (void 0 !== o) return o
      if (null == e || ('object' != typeof e && 'function' != typeof e)) return e
      if (i.has(e)) return i.get(e)
      if (Array.isArray(e)) {
        let t = Array(e.length)
        i.set(e, t)
        for (let o = 0; o < e.length; o++) t[o] = eh(e[o], o, n, i, r)
        return (
          Object.hasOwn(e, 'index') && (t.index = e.index),
          Object.hasOwn(e, 'input') && (t.input = e.input),
          t
        )
      }
      if (e instanceof Date) return new Date(e.getTime())
      if (e instanceof RegExp) {
        let t = new RegExp(e.source, e.flags)
        return ((t.lastIndex = e.lastIndex), t)
      }
      if (e instanceof Map) {
        let t = new Map()
        for (let [o, s] of (i.set(e, t), e)) t.set(o, eh(s, o, n, i, r))
        return t
      }
      if (e instanceof Set) {
        let t = new Set()
        for (let o of (i.set(e, t), e)) t.add(eh(o, void 0, n, i, r))
        return t
      }
      if ('u' > typeof Buffer && Buffer.isBuffer(e)) return e.subarray()
      if (ArrayBuffer.isView(e) && !(e instanceof DataView)) {
        let t = new (Object.getPrototypeOf(e).constructor)(e.length)
        i.set(e, t)
        for (let o = 0; o < e.length; o++) t[o] = eh(e[o], o, n, i, r)
        return t
      }
      if (
        e instanceof ArrayBuffer ||
        ('u' > typeof SharedArrayBuffer && e instanceof SharedArrayBuffer)
      )
        return e.slice(0)
      if (e instanceof DataView) {
        let t = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength)
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      if ('u' > typeof File && e instanceof File) {
        let t = new File([e], e.name, { type: e.type })
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      if ('u' > typeof Blob && e instanceof Blob) {
        let t = new Blob([e], { type: e.type })
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      if (e instanceof Error) {
        let t = new e.constructor()
        return (
          i.set(e, t),
          (t.message = e.message),
          (t.name = e.name),
          (t.stack = e.stack),
          (t.cause = e.cause),
          ev(t, e, n, i, r),
          t
        )
      }
      if (e instanceof Boolean) {
        let t = new Boolean(e.valueOf())
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      if (e instanceof Number) {
        let t = new Number(e.valueOf())
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      if (e instanceof String) {
        let t = new String(e.valueOf())
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      if (
        'object' == typeof e &&
        (function (e) {
          switch (L(e)) {
            case K:
            case et:
            case en:
            case er:
            case W:
            case X:
            case ef:
            case ep:
            case eu:
            case ec:
            case ed:
            case Y:
            case J:
            case ei:
            case Q:
            case ee:
            case H:
            case G:
            case eo:
            case es:
            case ea:
            case el:
              return !0
            default:
              return !1
          }
        })(e)
      ) {
        let t = Object.create(Object.getPrototypeOf(e))
        return (i.set(e, t), ev(t, e, n, i, r), t)
      }
      return e
    }
    function ev(e, t, n = e, i, r) {
      let o = [...Object.keys(t), ...N(t)]
      for (let s = 0; s < o.length; s++) {
        let a = o[s],
          l = Object.getOwnPropertyDescriptor(e, a)
        ;(null == l || l.writable) && (e[a] = eh(t[a], a, n, i, r))
      }
    }
    function ey(e) {
      return eh(e, void 0, e, new Map(), void 0)
    }
    function eg(e) {
      return {
        get current() {
          return ey(e.value)
        },
        subscribe: (t) => ({
          unsubscribe: D(() => {
            t(ey(e.value))
          }),
        }),
        subscribeOnce(t) {
          let n = !1,
            i = !1,
            r = () => void 0
          return (
            (r = D(() => {
              if (n) return
              let { value: o } = e
              if (null == o) return
              n = !0
              let s = null
              try {
                t(ey(o))
              } catch (e) {
                s = e instanceof Error ? e : Error(`Subscriber threw non-Error value: ${String(e)}`)
              }
              if ((i ? r() : queueMicrotask(r), s)) throw s
            })),
            (i = !0),
            {
              unsubscribe: () => {
                !n && ((n = !0), i && r())
              },
            }
          )
        },
      }
    }
    function em(e, t) {
      let n = eg(e)
      return {
        get current() {
          return n.current
        },
        subscribe(e) {
          let i = !1,
            r = ey(n.current)
          return n.subscribe((n) => {
            ;(i && t(r, n)) || ((i = !0), (r = ey(n)), e(n))
          })
        },
        subscribeOnce: (e) => n.subscribeOnce(e),
      }
    }
    let eb = A(),
      ew = A(),
      e_ = A(),
      ez = A(),
      ek = A(!0),
      eO = A(!1),
      eS = A(!1),
      e$ = A(),
      eE = q(() => void 0 !== e$.value),
      eP = A(),
      ex = {
        blockedEvent: ew,
        changes: eb,
        consent: e_,
        event: ez,
        online: ek,
        previewPanelAttached: eO,
        previewPanelOpen: eS,
        selectedPersonalizations: e$,
        canPersonalize: eE,
        profile: eP,
      },
      ej = { batch: k, computed: q, effect: D, untracked: S }
    function eI(e, t, n) {
      function i(n, i) {
        if (
          (n._zod ||
            Object.defineProperty(n, '_zod', {
              value: { def: i, constr: s, traits: new Set() },
              enumerable: !1,
            }),
          n._zod.traits.has(e))
        )
          return
        ;(n._zod.traits.add(e), t(n, i))
        let r = s.prototype,
          o = Object.keys(r)
        for (let e = 0; e < o.length; e++) {
          let t = o[e]
          t in n || (n[t] = r[t].bind(n))
        }
      }
      let r = n?.Parent ?? Object
      class o extends r {}
      function s(e) {
        var t
        let r = n?.Parent ? new o() : this
        for (let n of (i(r, e), (t = r._zod).deferred ?? (t.deferred = []), r._zod.deferred)) n()
        return r
      }
      return (
        Object.defineProperty(o, 'name', { value: e }),
        Object.defineProperty(s, 'init', { value: i }),
        Object.defineProperty(s, Symbol.hasInstance, {
          value: (t) => (!!n?.Parent && t instanceof n.Parent) || t?._zod?.traits?.has(e),
        }),
        Object.defineProperty(s, 'name', { value: e }),
        s
      )
    }
    ;(Object.freeze({ status: 'aborted' }), Symbol('zod_brand'))
    class eT extends Error {
      constructor() {
        super('Encountered Promise during synchronous parse. Use .parseAsync() instead.')
      }
    }
    let eA = {}
    function eB(e) {
      return (e && Object.assign(eA, e), eA)
    }
    function eF(e, t = '|') {
      return e.map((e) => eK(e)).join(t)
    }
    function eC(e, t) {
      return 'bigint' == typeof t ? t.toString() : t
    }
    function eR(e) {
      return {
        get value() {
          {
            let t = e()
            return (Object.defineProperty(this, 'value', { value: t }), t)
          }
        },
      }
    }
    function eq(e) {
      let t = +!!e.startsWith('^'),
        n = e.endsWith('$') ? e.length - 1 : e.length
      return e.slice(t, n)
    }
    let eM = Symbol('evaluating')
    function eU(e, t, n) {
      let i
      Object.defineProperty(e, t, {
        get() {
          if (i !== eM) return (void 0 === i && ((i = eM), (i = n())), i)
        },
        set(n) {
          Object.defineProperty(e, t, { value: n })
        },
        configurable: !0,
      })
    }
    function eV(e, t, n) {
      Object.defineProperty(e, t, { value: n, writable: !0, enumerable: !0, configurable: !0 })
    }
    function eZ(...e) {
      let t = {}
      for (let n of e) Object.assign(t, Object.getOwnPropertyDescriptors(n))
      return Object.defineProperties({}, t)
    }
    let eD = 'captureStackTrace' in Error ? Error.captureStackTrace : (...e) => {}
    function eN(e) {
      return 'object' == typeof e && null !== e && !Array.isArray(e)
    }
    function eL(e) {
      if (!1 === eN(e)) return !1
      let t = e.constructor
      if (void 0 === t || 'function' != typeof t) return !0
      let n = t.prototype
      return !1 !== eN(n) && !1 !== Object.prototype.hasOwnProperty.call(n, 'isPrototypeOf')
    }
    eR(() => {
      if ('u' > typeof navigator && navigator?.userAgent?.includes('Cloudflare')) return !1
      try {
        return (Function(''), !0)
      } catch (e) {
        return !1
      }
    })
    let eQ = new Set(['string', 'number', 'symbol'])
    function eH(e) {
      return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    function eJ(e, t, n) {
      let i = new e._zod.constr(t ?? e._zod.def)
      return ((!t || n?.parent) && (i._zod.parent = e), i)
    }
    function eW(e) {
      if (!e) return {}
      if ('string' == typeof e) return { error: () => e }
      if (e?.message !== void 0) {
        if (e?.error !== void 0) throw Error('Cannot specify both `message` and `error` params')
        e.error = e.message
      }
      return (delete e.message, 'string' == typeof e.error) ? { ...e, error: () => e.error } : e
    }
    function eK(e) {
      return 'bigint' == typeof e ? e.toString() + 'n' : 'string' == typeof e ? `"${e}"` : `${e}`
    }
    function eG(e, t = 0) {
      if (!0 === e.aborted) return !0
      for (let n = t; n < e.issues.length; n++) if (e.issues[n]?.continue !== !0) return !0
      return !1
    }
    function eX(e, t) {
      return t.map((t) => (t.path ?? (t.path = []), t.path.unshift(e), t))
    }
    function eY(e) {
      return 'string' == typeof e ? e : e?.message
    }
    function e0(e, t, n) {
      let i = { ...e, path: e.path ?? [] }
      return (
        e.message ||
          (i.message =
            eY(e.inst?._zod.def?.error?.(e)) ??
            eY(t?.error?.(e)) ??
            eY(n.customError?.(e)) ??
            eY(n.localeError?.(e)) ??
            'Invalid input'),
        delete i.inst,
        delete i.continue,
        t?.reportInput || delete i.input,
        i
      )
    }
    function e1(e) {
      return Array.isArray(e) ? 'array' : 'string' == typeof e ? 'string' : 'unknown'
    }
    let e2 = (e, t) => {
        ;((e.name = '$ZodError'),
          Object.defineProperty(e, '_zod', { value: e._zod, enumerable: !1 }),
          Object.defineProperty(e, 'issues', { value: t, enumerable: !1 }),
          (e.message = JSON.stringify(t, eC, 2)),
          Object.defineProperty(e, 'toString', { value: () => e.message, enumerable: !1 }))
      },
      e3 = eI('$ZodError', e2),
      e4 = eI('$ZodError', e2, { Parent: Error }),
      e6 =
        ((e = e4),
        (t, n, i, r) => {
          let o = i ? Object.assign(i, { async: !1 }) : { async: !1 },
            s = t._zod.run({ value: n, issues: [] }, o)
          if (s instanceof Promise) throw new eT()
          if (s.issues.length) {
            let t = new (r?.Err ?? e)(s.issues.map((e) => e0(e, o, eB())))
            throw (eD(t, r?.callee), t)
          }
          return s.value
        }),
      e5 =
        ((t = e4),
        async (e, n, i, r) => {
          let o = i ? Object.assign(i, { async: !0 }) : { async: !0 },
            s = e._zod.run({ value: n, issues: [] }, o)
          if ((s instanceof Promise && (s = await s), s.issues.length)) {
            let e = new (r?.Err ?? t)(s.issues.map((e) => e0(e, o, eB())))
            throw (eD(e, r?.callee), e)
          }
          return s.value
        }),
      e8 =
        ((n = e4),
        (e, t, i) => {
          let r = i ? { ...i, async: !1 } : { async: !1 },
            o = e._zod.run({ value: t, issues: [] }, r)
          if (o instanceof Promise) throw new eT()
          return o.issues.length
            ? { success: !1, error: new (n ?? e3)(o.issues.map((e) => e0(e, r, eB()))) }
            : { success: !0, data: o.value }
        }),
      e9 =
        ((i = e4),
        async (e, t, n) => {
          let r = n ? Object.assign(n, { async: !0 }) : { async: !0 },
            o = e._zod.run({ value: t, issues: [] }, r)
          return (
            o instanceof Promise && (o = await o),
            o.issues.length
              ? { success: !1, error: new i(o.issues.map((e) => e0(e, r, eB()))) }
              : { success: !0, data: o.value }
          )
        }),
      e7 =
        /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/,
      te =
        '(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))',
      tt = RegExp(`^${te}$`)
    function tn(e) {
      let t = '(?:[01]\\d|2[0-3]):[0-5]\\d'
      return 'number' == typeof e.precision
        ? -1 === e.precision
          ? `${t}`
          : 0 === e.precision
            ? `${t}:[0-5]\\d`
            : `${t}:[0-5]\\d\\.\\d{${e.precision}}`
        : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`
    }
    let ti = /^-?\d+(?:\.\d+)?$/,
      tr = /^(?:true|false)$/i,
      to = /^null$/i,
      ts = eI('$ZodCheck', (e, t) => {
        var n
        ;(e._zod ?? (e._zod = {}), (e._zod.def = t), (n = e._zod).onattach ?? (n.onattach = []))
      }),
      ta = eI('$ZodCheckMinLength', (e, t) => {
        var n
        ;(ts.init(e, t),
          (n = e._zod.def).when ??
            (n.when = (e) => {
              let t = e.value
              return null != t && void 0 !== t.length
            }),
          e._zod.onattach.push((e) => {
            let n = e._zod.bag.minimum ?? -1 / 0
            t.minimum > n && (e._zod.bag.minimum = t.minimum)
          }),
          (e._zod.check = (n) => {
            let i = n.value
            if (i.length >= t.minimum) return
            let r = e1(i)
            n.issues.push({
              origin: r,
              code: 'too_small',
              minimum: t.minimum,
              inclusive: !0,
              input: i,
              inst: e,
              continue: !t.abort,
            })
          }))
      }),
      tl = eI('$ZodCheckLengthEquals', (e, t) => {
        var n
        ;(ts.init(e, t),
          (n = e._zod.def).when ??
            (n.when = (e) => {
              let t = e.value
              return null != t && void 0 !== t.length
            }),
          e._zod.onattach.push((e) => {
            let n = e._zod.bag
            ;((n.minimum = t.length), (n.maximum = t.length), (n.length = t.length))
          }),
          (e._zod.check = (n) => {
            let i = n.value,
              r = i.length
            if (r === t.length) return
            let o = e1(i),
              s = r > t.length
            n.issues.push({
              origin: o,
              ...(s
                ? { code: 'too_big', maximum: t.length }
                : { code: 'too_small', minimum: t.length }),
              inclusive: !0,
              exact: !0,
              input: n.value,
              inst: e,
              continue: !t.abort,
            })
          }))
      }),
      tu = eI('$ZodCheckStringFormat', (e, t) => {
        var n, i
        ;(ts.init(e, t),
          e._zod.onattach.push((e) => {
            let n = e._zod.bag
            ;((n.format = t.format),
              t.pattern && (n.patterns ?? (n.patterns = new Set()), n.patterns.add(t.pattern)))
          }),
          t.pattern
            ? ((n = e._zod).check ??
              (n.check = (n) => {
                ;((t.pattern.lastIndex = 0),
                  t.pattern.test(n.value) ||
                    n.issues.push({
                      origin: 'string',
                      code: 'invalid_format',
                      format: t.format,
                      input: n.value,
                      ...(t.pattern ? { pattern: t.pattern.toString() } : {}),
                      inst: e,
                      continue: !t.abort,
                    }))
              }))
            : ((i = e._zod).check ?? (i.check = () => {})))
      }),
      tc = { major: 4, minor: 3, patch: 6 },
      td = eI('$ZodType', (e, t) => {
        var n
        ;(e ?? (e = {}), (e._zod.def = t), (e._zod.bag = e._zod.bag || {}), (e._zod.version = tc))
        let i = [...(e._zod.def.checks ?? [])]
        for (let t of (e._zod.traits.has('$ZodCheck') && i.unshift(e), i))
          for (let n of t._zod.onattach) n(e)
        if (0 === i.length)
          ((n = e._zod).deferred ?? (n.deferred = []),
            e._zod.deferred?.push(() => {
              e._zod.run = e._zod.parse
            }))
        else {
          let t = (e, t, n) => {
              let i,
                r = eG(e)
              for (let o of t) {
                if (o._zod.def.when) {
                  if (!o._zod.def.when(e)) continue
                } else if (r) continue
                let t = e.issues.length,
                  s = o._zod.check(e)
                if (s instanceof Promise && n?.async === !1) throw new eT()
                if (i || s instanceof Promise)
                  i = (i ?? Promise.resolve()).then(async () => {
                    ;(await s, e.issues.length !== t && (r || (r = eG(e, t))))
                  })
                else {
                  if (e.issues.length === t) continue
                  r || (r = eG(e, t))
                }
              }
              return i ? i.then(() => e) : e
            },
            n = (n, r, o) => {
              if (eG(n)) return ((n.aborted = !0), n)
              let s = t(r, i, o)
              if (s instanceof Promise) {
                if (!1 === o.async) throw new eT()
                return s.then((t) => e._zod.parse(t, o))
              }
              return e._zod.parse(s, o)
            }
          e._zod.run = (r, o) => {
            if (o.skipChecks) return e._zod.parse(r, o)
            if ('backward' === o.direction) {
              let t = e._zod.parse({ value: r.value, issues: [] }, { ...o, skipChecks: !0 })
              return t instanceof Promise ? t.then((e) => n(e, r, o)) : n(t, r, o)
            }
            let s = e._zod.parse(r, o)
            if (s instanceof Promise) {
              if (!1 === o.async) throw new eT()
              return s.then((e) => t(e, i, o))
            }
            return t(s, i, o)
          }
        }
        eU(e, '~standard', () => ({
          validate: (t) => {
            try {
              let n = e8(e, t)
              return n.success ? { value: n.data } : { issues: n.error?.issues }
            } catch (n) {
              return e9(e, t).then((e) =>
                e.success ? { value: e.data } : { issues: e.error?.issues },
              )
            }
          },
          vendor: 'zod',
          version: 1,
        }))
      }),
      tf = eI('$ZodString', (e, t) => {
        var n
        let i
        ;(td.init(e, t),
          (e._zod.pattern =
            [...(e?._zod.bag?.patterns ?? [])].pop() ??
            ((i = (n = e._zod.bag)
              ? `[\\s\\S]{${n?.minimum ?? 0},${n?.maximum ?? ''}}`
              : '[\\s\\S]*'),
            RegExp(`^${i}$`))),
          (e._zod.parse = (n, i) => {
            if (t.coerce)
              try {
                n.value = String(n.value)
              } catch (e) {}
            return (
              'string' == typeof n.value ||
                n.issues.push({
                  expected: 'string',
                  code: 'invalid_type',
                  input: n.value,
                  inst: e,
                }),
              n
            )
          }))
      }),
      tp = eI('$ZodStringFormat', (e, t) => {
        ;(tu.init(e, t), tf.init(e, t))
      }),
      th = eI('$ZodISODateTime', (e, t) => {
        let n, i, r
        ;(t.pattern ??
          ((n = tn({ precision: t.precision })),
          (i = ['Z']),
          t.local && i.push(''),
          t.offset && i.push('([+-](?:[01]\\d|2[0-3]):[0-5]\\d)'),
          (r = `${n}(?:${i.join('|')})`),
          (t.pattern = RegExp(`^${te}T(?:${r})$`))),
          tp.init(e, t))
      }),
      tv =
        ((e, t) => {
          ;(t.pattern ?? (t.pattern = tt), tp.init(e, t))
        },
        eI('$ZodNumber', (e, t) => {
          ;(td.init(e, t),
            (e._zod.pattern = e._zod.bag.pattern ?? ti),
            (e._zod.parse = (n, i) => {
              if (t.coerce)
                try {
                  n.value = Number(n.value)
                } catch (e) {}
              let r = n.value
              if ('number' == typeof r && !Number.isNaN(r) && Number.isFinite(r)) return n
              let o =
                'number' == typeof r
                  ? Number.isNaN(r)
                    ? 'NaN'
                    : Number.isFinite(r)
                      ? void 0
                      : 'Infinity'
                  : void 0
              return (
                n.issues.push({
                  expected: 'number',
                  code: 'invalid_type',
                  input: r,
                  inst: e,
                  ...(o ? { received: o } : {}),
                }),
                n
              )
            }))
        })),
      ty = eI('$ZodBoolean', (e, t) => {
        ;(td.init(e, t),
          (e._zod.pattern = tr),
          (e._zod.parse = (n, i) => {
            if (t.coerce)
              try {
                n.value = !!n.value
              } catch (e) {}
            let r = n.value
            return (
              'boolean' == typeof r ||
                n.issues.push({ expected: 'boolean', code: 'invalid_type', input: r, inst: e }),
              n
            )
          }))
      }),
      tg = eI('$ZodNull', (e, t) => {
        ;(td.init(e, t),
          (e._zod.pattern = to),
          (e._zod.values = new Set([null])),
          (e._zod.parse = (t, n) => {
            let i = t.value
            return (
              null === i ||
                t.issues.push({ expected: 'null', code: 'invalid_type', input: i, inst: e }),
              t
            )
          }))
      }),
      tm = eI('$ZodAny', (e, t) => {
        ;(td.init(e, t), (e._zod.parse = (e) => e))
      }),
      tb = eI('$ZodUnknown', (e, t) => {
        ;(td.init(e, t), (e._zod.parse = (e) => e))
      })
    function tw(e, t, n) {
      ;(e.issues.length && t.issues.push(...eX(n, e.issues)), (t.value[n] = e.value))
    }
    let t_ = eI('$ZodArray', (e, t) => {
      ;(td.init(e, t),
        (e._zod.parse = (n, i) => {
          let r = n.value
          if (!Array.isArray(r))
            return (
              n.issues.push({ expected: 'array', code: 'invalid_type', input: r, inst: e }),
              n
            )
          n.value = Array(r.length)
          let o = []
          for (let e = 0; e < r.length; e++) {
            let s = r[e],
              a = t.element._zod.run({ value: s, issues: [] }, i)
            a instanceof Promise ? o.push(a.then((t) => tw(t, n, e))) : tw(a, n, e)
          }
          return o.length ? Promise.all(o).then(() => n) : n
        }))
    })
    function tz(e, t, n, i, r) {
      if (e.issues.length) {
        if (r && !(n in i)) return
        t.issues.push(...eX(n, e.issues))
      }
      void 0 === e.value ? n in i && (t.value[n] = void 0) : (t.value[n] = e.value)
    }
    let tk = eI('$ZodObject', (e, t) => {
      let n
      td.init(e, t)
      let i = Object.getOwnPropertyDescriptor(t, 'shape')
      if (!i?.get) {
        let e = t.shape
        Object.defineProperty(t, 'shape', {
          get: () => {
            let n = { ...e }
            return (Object.defineProperty(t, 'shape', { value: n }), n)
          },
        })
      }
      let r = eR(() =>
        (function (e) {
          var t
          let n = Object.keys(e.shape)
          for (let t of n)
            if (!e.shape?.[t]?._zod?.traits?.has('$ZodType'))
              throw Error(`Invalid element at key "${t}": expected a Zod schema`)
          let i = Object.keys((t = e.shape)).filter(
            (e) => 'optional' === t[e]._zod.optin && 'optional' === t[e]._zod.optout,
          )
          return { ...e, keys: n, keySet: new Set(n), numKeys: n.length, optionalKeys: new Set(i) }
        })(t),
      )
      eU(e._zod, 'propValues', () => {
        let e = t.shape,
          n = {}
        for (let t in e) {
          let i = e[t]._zod
          if (i.values) for (let e of (n[t] ?? (n[t] = new Set()), i.values)) n[t].add(e)
        }
        return n
      })
      let o = t.catchall
      e._zod.parse = (t, i) => {
        n ?? (n = r.value)
        let s = t.value
        if (!eN(s))
          return (t.issues.push({ expected: 'object', code: 'invalid_type', input: s, inst: e }), t)
        t.value = {}
        let a = [],
          l = n.shape
        for (let e of n.keys) {
          let n = l[e],
            r = 'optional' === n._zod.optout,
            o = n._zod.run({ value: s[e], issues: [] }, i)
          o instanceof Promise ? a.push(o.then((n) => tz(n, t, e, s, r))) : tz(o, t, e, s, r)
        }
        return o
          ? (function (e, t, n, i, r, o) {
              let s = [],
                a = r.keySet,
                l = r.catchall._zod,
                u = l.def.type,
                c = 'optional' === l.optout
              for (let r in t) {
                if (a.has(r)) continue
                if ('never' === u) {
                  s.push(r)
                  continue
                }
                let o = l.run({ value: t[r], issues: [] }, i)
                o instanceof Promise ? e.push(o.then((e) => tz(e, n, r, t, c))) : tz(o, n, r, t, c)
              }
              return (s.length &&
                n.issues.push({ code: 'unrecognized_keys', keys: s, input: t, inst: o }),
              e.length)
                ? Promise.all(e).then(() => n)
                : n
            })(a, s, t, i, r.value, e)
          : a.length
            ? Promise.all(a).then(() => t)
            : t
      }
    })
    function tO(e, t, n, i) {
      for (let n of e) if (0 === n.issues.length) return ((t.value = n.value), t)
      let r = e.filter((e) => !eG(e))
      return 1 === r.length
        ? ((t.value = r[0].value), r[0])
        : (t.issues.push({
            code: 'invalid_union',
            input: t.value,
            inst: n,
            errors: e.map((e) => e.issues.map((e) => e0(e, i, eB()))),
          }),
          t)
    }
    let tS = eI('$ZodUnion', (e, t) => {
        ;(td.init(e, t),
          eU(e._zod, 'optin', () =>
            t.options.some((e) => 'optional' === e._zod.optin) ? 'optional' : void 0,
          ),
          eU(e._zod, 'optout', () =>
            t.options.some((e) => 'optional' === e._zod.optout) ? 'optional' : void 0,
          ),
          eU(e._zod, 'values', () => {
            if (t.options.every((e) => e._zod.values))
              return new Set(t.options.flatMap((e) => Array.from(e._zod.values)))
          }),
          eU(e._zod, 'pattern', () => {
            if (t.options.every((e) => e._zod.pattern)) {
              let e = t.options.map((e) => e._zod.pattern)
              return RegExp(`^(${e.map((e) => eq(e.source)).join('|')})$`)
            }
          }))
        let n = 1 === t.options.length,
          i = t.options[0]._zod.run
        e._zod.parse = (r, o) => {
          if (n) return i(r, o)
          let s = !1,
            a = []
          for (let e of t.options) {
            let t = e._zod.run({ value: r.value, issues: [] }, o)
            if (t instanceof Promise) (a.push(t), (s = !0))
            else {
              if (0 === t.issues.length) return t
              a.push(t)
            }
          }
          return s ? Promise.all(a).then((t) => tO(t, r, e, o)) : tO(a, r, e, o)
        }
      }),
      t$ = eI('$ZodDiscriminatedUnion', (e, t) => {
        ;((t.inclusive = !1), tS.init(e, t))
        let n = e._zod.parse
        eU(e._zod, 'propValues', () => {
          let e = {}
          for (let n of t.options) {
            let i = n._zod.propValues
            if (!i || 0 === Object.keys(i).length)
              throw Error(`Invalid discriminated union option at index "${t.options.indexOf(n)}"`)
            for (let [t, n] of Object.entries(i))
              for (let i of (e[t] || (e[t] = new Set()), n)) e[t].add(i)
          }
          return e
        })
        let i = eR(() => {
          let e = t.options,
            n = new Map()
          for (let i of e) {
            let e = i._zod.propValues?.[t.discriminator]
            if (!e || 0 === e.size)
              throw Error(`Invalid discriminated union option at index "${t.options.indexOf(i)}"`)
            for (let t of e) {
              if (n.has(t)) throw Error(`Duplicate discriminator value "${String(t)}"`)
              n.set(t, i)
            }
          }
          return n
        })
        e._zod.parse = (r, o) => {
          let s = r.value
          if (!eN(s))
            return (
              r.issues.push({ code: 'invalid_type', expected: 'object', input: s, inst: e }),
              r
            )
          let a = i.value.get(s?.[t.discriminator])
          return a
            ? a._zod.run(r, o)
            : t.unionFallback
              ? n(r, o)
              : (r.issues.push({
                  code: 'invalid_union',
                  errors: [],
                  note: 'No matching discriminator',
                  discriminator: t.discriminator,
                  input: s,
                  path: [t.discriminator],
                  inst: e,
                }),
                r)
        }
      }),
      tE = eI('$ZodRecord', (e, t) => {
        ;(td.init(e, t),
          (e._zod.parse = (n, i) => {
            let r = n.value
            if (!eL(r))
              return (
                n.issues.push({ expected: 'record', code: 'invalid_type', input: r, inst: e }),
                n
              )
            let o = [],
              s = t.keyType._zod.values
            if (s) {
              let a
              n.value = {}
              let l = new Set()
              for (let e of s)
                if ('string' == typeof e || 'number' == typeof e || 'symbol' == typeof e) {
                  l.add('number' == typeof e ? e.toString() : e)
                  let s = t.valueType._zod.run({ value: r[e], issues: [] }, i)
                  s instanceof Promise
                    ? o.push(
                        s.then((t) => {
                          ;(t.issues.length && n.issues.push(...eX(e, t.issues)),
                            (n.value[e] = t.value))
                        }),
                      )
                    : (s.issues.length && n.issues.push(...eX(e, s.issues)), (n.value[e] = s.value))
                }
              for (let e in r) l.has(e) || (a = a ?? []).push(e)
              a &&
                a.length > 0 &&
                n.issues.push({ code: 'unrecognized_keys', input: r, inst: e, keys: a })
            } else
              for (let s of ((n.value = {}), Reflect.ownKeys(r))) {
                if ('__proto__' === s) continue
                let a = t.keyType._zod.run({ value: s, issues: [] }, i)
                if (a instanceof Promise)
                  throw Error('Async schemas not supported in object keys currently')
                if ('string' == typeof s && ti.test(s) && a.issues.length) {
                  let e = t.keyType._zod.run({ value: Number(s), issues: [] }, i)
                  if (e instanceof Promise)
                    throw Error('Async schemas not supported in object keys currently')
                  0 === e.issues.length && (a = e)
                }
                if (a.issues.length) {
                  'loose' === t.mode
                    ? (n.value[s] = r[s])
                    : n.issues.push({
                        code: 'invalid_key',
                        origin: 'record',
                        issues: a.issues.map((e) => e0(e, i, eB())),
                        input: s,
                        path: [s],
                        inst: e,
                      })
                  continue
                }
                let l = t.valueType._zod.run({ value: r[s], issues: [] }, i)
                l instanceof Promise
                  ? o.push(
                      l.then((e) => {
                        ;(e.issues.length && n.issues.push(...eX(s, e.issues)),
                          (n.value[a.value] = e.value))
                      }),
                    )
                  : (l.issues.length && n.issues.push(...eX(s, l.issues)),
                    (n.value[a.value] = l.value))
              }
            return o.length ? Promise.all(o).then(() => n) : n
          }))
      }),
      tP = eI('$ZodEnum', (e, t) => {
        var n
        let i
        td.init(e, t)
        let r =
            ((i = Object.values((n = t.entries)).filter((e) => 'number' == typeof e)),
            Object.entries(n)
              .filter(([e, t]) => -1 === i.indexOf(+e))
              .map(([e, t]) => t)),
          o = new Set(r)
        ;((e._zod.values = o),
          (e._zod.pattern = RegExp(
            `^(${r
              .filter((e) => eQ.has(typeof e))
              .map((e) => ('string' == typeof e ? eH(e) : e.toString()))
              .join('|')})$`,
          )),
          (e._zod.parse = (t, n) => {
            let i = t.value
            return (
              o.has(i) || t.issues.push({ code: 'invalid_value', values: r, input: i, inst: e }),
              t
            )
          }))
      }),
      tx = eI('$ZodLiteral', (e, t) => {
        if ((td.init(e, t), 0 === t.values.length))
          throw Error('Cannot create literal schema with no valid values')
        let n = new Set(t.values)
        ;((e._zod.values = n),
          (e._zod.pattern = RegExp(
            `^(${t.values.map((e) => ('string' == typeof e ? eH(e) : e ? eH(e.toString()) : String(e))).join('|')})$`,
          )),
          (e._zod.parse = (i, r) => {
            let o = i.value
            return (
              n.has(o) ||
                i.issues.push({ code: 'invalid_value', values: t.values, input: o, inst: e }),
              i
            )
          }))
      })
    function tj(e, t) {
      return e.issues.length && void 0 === t ? { issues: [], value: void 0 } : e
    }
    let tI = eI('$ZodOptional', (e, t) => {
        ;(td.init(e, t),
          (e._zod.optin = 'optional'),
          (e._zod.optout = 'optional'),
          eU(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, void 0]) : void 0,
          ),
          eU(e._zod, 'pattern', () => {
            let e = t.innerType._zod.pattern
            return e ? RegExp(`^(${eq(e.source)})?$`) : void 0
          }),
          (e._zod.parse = (e, n) => {
            if ('optional' === t.innerType._zod.optin) {
              let i = t.innerType._zod.run(e, n)
              return i instanceof Promise ? i.then((t) => tj(t, e.value)) : tj(i, e.value)
            }
            return void 0 === e.value ? e : t.innerType._zod.run(e, n)
          }))
      }),
      tT = eI('$ZodNullable', (e, t) => {
        ;(td.init(e, t),
          eU(e._zod, 'optin', () => t.innerType._zod.optin),
          eU(e._zod, 'optout', () => t.innerType._zod.optout),
          eU(e._zod, 'pattern', () => {
            let e = t.innerType._zod.pattern
            return e ? RegExp(`^(${eq(e.source)}|null)$`) : void 0
          }),
          eU(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, null]) : void 0,
          ),
          (e._zod.parse = (e, n) => (null === e.value ? e : t.innerType._zod.run(e, n))))
      }),
      tA = eI('$ZodPrefault', (e, t) => {
        ;(td.init(e, t),
          (e._zod.optin = 'optional'),
          eU(e._zod, 'values', () => t.innerType._zod.values),
          (e._zod.parse = (e, n) => (
            'backward' === n.direction || (void 0 === e.value && (e.value = t.defaultValue)),
            t.innerType._zod.run(e, n)
          )))
      }),
      tB = eI('$ZodLazy', (e, t) => {
        ;(td.init(e, t),
          eU(e._zod, 'innerType', () => t.getter()),
          eU(e._zod, 'pattern', () => e._zod.innerType?._zod?.pattern),
          eU(e._zod, 'propValues', () => e._zod.innerType?._zod?.propValues),
          eU(e._zod, 'optin', () => e._zod.innerType?._zod?.optin ?? void 0),
          eU(e._zod, 'optout', () => e._zod.innerType?._zod?.optout ?? void 0),
          (e._zod.parse = (t, n) => e._zod.innerType._zod.run(t, n)))
      })
    ;(Symbol('ZodOutput'), Symbol('ZodInput'))
    function tF(e, t) {
      return new ta({ check: 'min_length', ...eW(t), minimum: e })
    }
    ;(a = globalThis).__zod_globalRegistry ??
      (a.__zod_globalRegistry = new (class e {
        constructor() {
          ;((this._map = new WeakMap()), (this._idmap = new Map()))
        }
        add(e, ...t) {
          let n = t[0]
          return (
            this._map.set(e, n),
            n && 'object' == typeof n && 'id' in n && this._idmap.set(n.id, e),
            this
          )
        }
        clear() {
          return ((this._map = new WeakMap()), (this._idmap = new Map()), this)
        }
        remove(e) {
          let t = this._map.get(e)
          return (
            t && 'object' == typeof t && 'id' in t && this._idmap.delete(t.id),
            this._map.delete(e),
            this
          )
        }
        get(e) {
          let t = e._zod.parent
          if (t) {
            let n = { ...(this.get(t) ?? {}) }
            delete n.id
            let i = { ...n, ...this._map.get(e) }
            return Object.keys(i).length ? i : void 0
          }
          return this._map.get(e)
        }
        has(e) {
          return this._map.has(e)
        }
      })())
    let tC = eI('ZodMiniType', (e, t) => {
        if (!e._zod) throw Error('Uninitialized schema in ZodMiniType.')
        ;(td.init(e, t),
          (e.def = t),
          (e.type = t.type),
          (e.parse = (t, n) => e6(e, t, n, { callee: e.parse })),
          (e.safeParse = (t, n) => e8(e, t, n)),
          (e.parseAsync = async (t, n) => e5(e, t, n, { callee: e.parseAsync })),
          (e.safeParseAsync = async (t, n) => e9(e, t, n)),
          (e.check = (...n) =>
            e.clone(
              {
                ...t,
                checks: [
                  ...(t.checks ?? []),
                  ...n.map((e) =>
                    'function' == typeof e
                      ? { _zod: { check: e, def: { check: 'custom' }, onattach: [] } }
                      : e,
                  ),
                ],
              },
              { parent: !0 },
            )),
          (e.with = e.check),
          (e.clone = (t, n) => eJ(e, t, n)),
          (e.brand = () => e),
          (e.register = (t, n) => (t.add(e, n), e)),
          (e.apply = (t) => t(e)))
      }),
      tR = eI('ZodMiniString', (e, t) => {
        ;(tf.init(e, t), tC.init(e, t))
      })
    function tq(e) {
      return new tR({ type: 'string', ...eW(e) })
    }
    let tM = eI('ZodMiniStringFormat', (e, t) => {
        ;(tp.init(e, t), tR.init(e, t))
      }),
      tU = eI('ZodMiniNumber', (e, t) => {
        ;(tv.init(e, t), tC.init(e, t))
      })
    function tV(e) {
      return new tU({ type: 'number', checks: [], ...eW(e) })
    }
    let tZ = eI('ZodMiniBoolean', (e, t) => {
      ;(ty.init(e, t), tC.init(e, t))
    })
    function tD(e) {
      return new tZ({ type: 'boolean', ...eW(e) })
    }
    let tN = eI('ZodMiniNull', (e, t) => {
      ;(tg.init(e, t), tC.init(e, t))
    })
    function tL(e) {
      return new tN({ type: 'null', ...eW(e) })
    }
    let tQ = eI('ZodMiniAny', (e, t) => {
      ;(tm.init(e, t), tC.init(e, t))
    })
    function tH() {
      return new tQ({ type: 'any' })
    }
    let tJ = eI('ZodMiniUnknown', (e, t) => {
        ;(tb.init(e, t), tC.init(e, t))
      }),
      tW = eI('ZodMiniArray', (e, t) => {
        ;(t_.init(e, t), tC.init(e, t))
      })
    function tK(e, t) {
      return new tW({ type: 'array', element: e, ...eW(t) })
    }
    let tG = eI('ZodMiniObject', (e, t) => {
      ;(tk.init(e, t), tC.init(e, t), eU(e, 'shape', () => t.shape))
    })
    function tX(e, t) {
      return new tG({ type: 'object', shape: e ?? {}, ...eW(t) })
    }
    function tY(e, t) {
      if (!eL(t)) throw Error('Invalid input to extend: expected a plain object')
      let n = e._zod.def.checks
      if (n && n.length > 0) {
        let n = e._zod.def.shape
        for (let e in t)
          if (void 0 !== Object.getOwnPropertyDescriptor(n, e))
            throw Error(
              'Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.',
            )
      }
      let i = eZ(e._zod.def, {
        get shape() {
          let n = { ...e._zod.def.shape, ...t }
          return (eV(this, 'shape', n), n)
        },
      })
      return eJ(e, i)
    }
    function t0(e, t) {
      return e.clone({ ...e._zod.def, catchall: t })
    }
    let t1 = eI('ZodMiniUnion', (e, t) => {
      ;(tS.init(e, t), tC.init(e, t))
    })
    function t2(e, t) {
      return new t1({ type: 'union', options: e, ...eW(t) })
    }
    let t3 = eI('ZodMiniDiscriminatedUnion', (e, t) => {
      ;(t$.init(e, t), tC.init(e, t))
    })
    function t4(e, t, n) {
      return new t3({ type: 'union', options: t, discriminator: e, ...eW(n) })
    }
    let t6 = eI('ZodMiniRecord', (e, t) => {
      ;(tE.init(e, t), tC.init(e, t))
    })
    function t5(e, t, n) {
      return new t6({ type: 'record', keyType: e, valueType: t, ...eW(n) })
    }
    let t8 = eI('ZodMiniEnum', (e, t) => {
      ;(tP.init(e, t), tC.init(e, t), (e.options = Object.values(t.entries)))
    })
    function t9(e, t) {
      return new t8({
        type: 'enum',
        entries: Array.isArray(e) ? Object.fromEntries(e.map((e) => [e, e])) : e,
        ...eW(t),
      })
    }
    let t7 = eI('ZodMiniLiteral', (e, t) => {
      ;(tx.init(e, t), tC.init(e, t))
    })
    function ne(e, t) {
      return new t7({ type: 'literal', values: Array.isArray(e) ? e : [e], ...eW(t) })
    }
    let nt = eI('ZodMiniOptional', (e, t) => {
      ;(tI.init(e, t), tC.init(e, t))
    })
    function nn(e) {
      return new nt({ type: 'optional', innerType: e })
    }
    let ni = eI('ZodMiniNullable', (e, t) => {
      ;(tT.init(e, t), tC.init(e, t))
    })
    function nr(e) {
      return new ni({ type: 'nullable', innerType: e })
    }
    let no = eI('ZodMiniPrefault', (e, t) => {
      ;(tA.init(e, t), tC.init(e, t))
    })
    function ns(e, t) {
      return new no({
        type: 'prefault',
        innerType: e,
        get defaultValue() {
          return 'function' == typeof t ? t() : eL(t) ? { ...t } : Array.isArray(t) ? [...t] : t
        },
      })
    }
    let na = eI('ZodMiniLazy', (e, t) => {
      ;(tB.init(e, t), tC.init(e, t))
    })
    function nl() {
      let e = new na({
        type: 'lazy',
        getter: () => t2([tq(), tV(), tD(), tL(), tK(e), t5(tq(), e)]),
      })
      return e
    }
    let nu = eI('ZodMiniISODateTime', (e, t) => {
      ;(th.init(e, t), tM.init(e, t))
    })
    function nc(e) {
      return new nu({
        type: 'string',
        format: 'datetime',
        check: 'string_format',
        offset: !1,
        local: !1,
        precision: null,
        ...eW(e),
      })
    }
    let nd = t0(tX({}), nl()),
      nf = tX({ sys: tX({ type: ne('Link'), linkType: tq(), id: tq() }) }),
      np = tX({ sys: tX({ type: ne('Link'), linkType: ne('ContentType'), id: tq() }) }),
      nh = tX({ sys: tX({ type: ne('Link'), linkType: ne('Environment'), id: tq() }) }),
      nv = tX({ sys: tX({ type: ne('Link'), linkType: ne('Space'), id: tq() }) }),
      ny = tX({ sys: tX({ type: ne('Link'), linkType: ne('TaxonomyConcept'), id: tq() }) }),
      ng = tX({ sys: tX({ type: ne('Link'), linkType: ne('Tag'), id: tq() }) }),
      nm = tX({
        type: ne('Entry'),
        contentType: np,
        publishedVersion: tV(),
        id: tq(),
        createdAt: tH(),
        updatedAt: tH(),
        locale: nn(tq()),
        revision: tV(),
        space: nv,
        environment: nh,
      }),
      nb = tX({ fields: nd, metadata: tX({ tags: tK(ng), concepts: nn(tK(ny)) }), sys: nm }),
      nw = tY(nd, { nt_audience_id: tq(), nt_name: nn(tq()), nt_description: nn(tq()) }),
      n_ = tY(nb, { fields: nw })
    tX({ contentTypeId: ne('nt_audience'), fields: nw })
    let nz = tY(nb, {
        fields: tX({ nt_name: tq(), nt_fallback: nn(tq()), nt_mergetag_id: tq() }),
        sys: tY(nm, {
          contentType: tX({
            sys: tX({ type: ne('Link'), linkType: ne('ContentType'), id: ne('nt_mergetag') }),
          }),
        }),
      }),
      nk = tX({ id: tq(), hidden: nn(tD()) }),
      nO = tX({ type: nn(ne('EntryReplacement')), baseline: nk, variants: tK(nk) }),
      nS = tX({ value: t2([tq(), tD(), tL(), tV(), t5(tq(), nl())]) }),
      n$ = t9(['Boolean', 'Number', 'Object', 'String']),
      nE = t4('type', [
        nO,
        tX({
          type: ne('InlineVariable'),
          key: tq(),
          valueType: n$,
          baseline: nS,
          variants: tK(nS),
        }),
      ]),
      nP = tK(nE),
      nx = tX({
        distribution: nn(tK(tV())),
        traffic: nn(tV()),
        components: nn(nP),
        sticky: nn(tD()),
      }),
      nj = t2([ne('nt_experiment'), ne('nt_personalization')]),
      nI = tY(nd, {
        nt_name: tq(),
        nt_description: nn(nr(tq())),
        nt_type: nj,
        nt_config: nn(nr(nx)),
        nt_audience: nn(nr(n_)),
        nt_variants: nn(tK(t2([nf, nb]))),
        nt_experience_id: tq(),
      }),
      nT = tY(nb, { fields: nI })
    tX({ contentTypeId: ne('nt_experience'), fields: nI })
    let nA = tY(nb, { fields: tY(nd, { nt_experiences: tK(t2([nf, nT])) }) })
    function nB(e) {
      return nT.safeParse(e).success
    }
    function nF(e) {
      return nA.safeParse(e).success
    }
    let nC = nn(tX({ name: tq(), version: tq() })),
      nR = tX({
        name: nn(tq()),
        source: nn(tq()),
        medium: nn(tq()),
        term: nn(tq()),
        content: nn(tq()),
      }),
      nq = t2([ne('mobile'), ne('server'), ne('web')]),
      nM = t5(tq(), tq()),
      nU = tX({ latitude: tV(), longitude: tV() }),
      nV = tX({
        coordinates: nn(nU),
        city: nn(tq()),
        postalCode: nn(tq()),
        region: nn(tq()),
        regionCode: nn(tq()),
        country: nn(tq()),
        countryCode: nn(tq().check(new tl({ check: 'length_equals', ...eW(void 0), length: 2 }))),
        continent: nn(tq()),
        timezone: nn(tq()),
      }),
      nZ = tX({ name: tq(), version: tq() }),
      nD = t0(
        tX({ path: tq(), query: nM, referrer: tq(), search: tq(), title: nn(tq()), url: tq() }),
        nl(),
      ),
      nN = t5(tq(), nl()),
      nL = t0(tX({ name: tq() }), nl()),
      nQ = t5(tq(), nl()),
      nH = tX({
        app: nC,
        campaign: nR,
        gdpr: tX({ isConsentGiven: tD() }),
        library: nZ,
        locale: tq(),
        location: nn(nV),
        userAgent: nn(tq()),
      }),
      nJ = tX({
        channel: nq,
        context: tY(nH, { page: nn(nD), screen: nn(nL) }),
        messageId: tq(),
        originalTimestamp: nc(),
        sentAt: nc(),
        timestamp: nc(),
        userId: nn(tq()),
      }),
      nW = tY(nJ, { type: ne('alias') }),
      nK = tY(nJ, { type: ne('group') }),
      nG = tY(nJ, { type: ne('identify'), traits: nQ }),
      nX = tY(nH, { page: nD }),
      nY = tY(nJ, { type: ne('page'), name: nn(tq()), properties: nD, context: nX }),
      n0 = tY(nH, { screen: nL }),
      n1 = tY(nJ, { type: ne('screen'), name: tq(), properties: nn(nN), context: n0 }),
      n2 = tY(nJ, { type: ne('track'), event: tq(), properties: nN }),
      n3 = tY(nJ, {
        componentType: t2([ne('Entry'), ne('Variable')]),
        componentId: tq(),
        experienceId: nn(tq()),
        variantIndex: tV(),
      }),
      n4 = tY(n3, { type: ne('component'), viewDurationMs: nn(tV()), viewId: nn(tq()) }),
      n6 = { anonymousId: tq() },
      n5 = tK(
        t4('type', [
          tY(nW, n6),
          tY(n4, n6),
          tY(nK, n6),
          tY(nG, n6),
          tY(nY, n6),
          tY(n1, n6),
          tY(n2, n6),
        ]),
      ),
      n8 = t4('type', [nW, n4, nK, nG, nY, n1, n2]),
      n9 = tK(n8),
      n7 = tX({ features: nn(tK(tq())) }),
      ie = tX({ events: n9.check(tF(1)), options: nn(n7) }),
      it = tX({ events: n5.check(tF(1)), options: nn(n7) }),
      ii = tX({
        id: tq(),
        isReturningVisitor: tD(),
        landingPage: nD,
        count: tV(),
        activeSessionLength: tV(),
        averageSessionLength: tV(),
      }),
      ir = tX({
        id: tq(),
        stableId: tq(),
        random: tV(),
        audiences: tK(tq()),
        traits: nQ,
        location: nV,
        session: ii,
      }),
      io = t0(tX({ id: tq() }), nl()),
      is = tX({ data: tX(), message: tq(), error: nr(tD()) }),
      ia = tY(is, { data: tX({ profiles: nn(tK(ir)) }) }),
      il = tX({
        key: tq(),
        type: t2([t9(['Variable']), tq()]),
        meta: tX({ experienceId: tq(), variantIndex: tV() }),
      }),
      iu = t2([tq(), tD(), tL(), tV(), t5(tq(), nl())])
    tY(il, { type: tq(), value: new tJ({ type: 'unknown' }) })
    let ic = tK(t4('type', [tY(il, { type: ne('Variable'), value: iu })])),
      id = tK(
        tX({
          experienceId: tq(),
          variantIndex: tV(),
          variants: t5(tq(), tq()),
          sticky: nn(ns(tD(), !1)),
        }),
      ),
      ip = tY(is, { data: tX({ profile: ir, experiences: id, changes: ic }) }),
      ih = t4('type', [
        n4,
        tY(n3, { type: ne('component_click') }),
        tY(n3, { type: ne('component_hover'), hoverDurationMs: tV(), hoverId: tq() }),
      ]),
      iv = tX({ profile: io, events: tK(ih) }),
      iy = tK(iv)
    function ig(e, t) {
      let n = e.safeParse(t)
      if (n.success) return n.data
      throw Error(
        (function (e) {
          let t = []
          for (let n of [...e.issues].sort((e, t) => (e.path ?? []).length - (t.path ?? []).length))
            (t.push(`✖ ${n.message}`),
              n.path?.length &&
                t.push(
                  `  → at ${(function (e) {
                    let t = []
                    for (let n of e.map((e) => ('object' == typeof e ? e.key : e)))
                      'number' == typeof n
                        ? t.push(`[${n}]`)
                        : 'symbol' == typeof n
                          ? t.push(`[${JSON.stringify(String(n))}]`)
                          : /[^\w$]/.test(n)
                            ? t.push(`[${JSON.stringify(n)}]`)
                            : (t.length && t.push('.'), t.push(n))
                    return t.join('')
                  })(n.path)}`,
                ))
          return t.join('\n')
        })(n.error),
      )
    }
    eB({
      localeError:
        ((r = {
          string: { unit: 'characters', verb: 'to have' },
          file: { unit: 'bytes', verb: 'to have' },
          array: { unit: 'items', verb: 'to have' },
          set: { unit: 'items', verb: 'to have' },
          map: { unit: 'entries', verb: 'to have' },
        }),
        (o = {
          regex: 'input',
          email: 'email address',
          url: 'URL',
          emoji: 'emoji',
          uuid: 'UUID',
          uuidv4: 'UUIDv4',
          uuidv6: 'UUIDv6',
          nanoid: 'nanoid',
          guid: 'GUID',
          cuid: 'cuid',
          cuid2: 'cuid2',
          ulid: 'ULID',
          xid: 'XID',
          ksuid: 'KSUID',
          datetime: 'ISO datetime',
          date: 'ISO date',
          time: 'ISO time',
          duration: 'ISO duration',
          ipv4: 'IPv4 address',
          ipv6: 'IPv6 address',
          mac: 'MAC address',
          cidrv4: 'IPv4 range',
          cidrv6: 'IPv6 range',
          base64: 'base64-encoded string',
          base64url: 'base64url-encoded string',
          json_string: 'JSON string',
          e164: 'E.164 number',
          jwt: 'JWT',
          template_literal: 'input',
        }),
        (s = { nan: 'NaN' }),
        (e) => {
          switch (e.code) {
            case 'invalid_type': {
              let t = s[e.expected] ?? e.expected,
                n = (function (e) {
                  let t = typeof e
                  switch (t) {
                    case 'number':
                      return Number.isNaN(e) ? 'nan' : 'number'
                    case 'object':
                      if (null === e) return 'null'
                      if (Array.isArray(e)) return 'array'
                      if (
                        e &&
                        Object.getPrototypeOf(e) !== Object.prototype &&
                        'constructor' in e &&
                        e.constructor
                      )
                        return e.constructor.name
                  }
                  return t
                })(e.input),
                i = s[n] ?? n
              return `Invalid input: expected ${t}, received ${i}`
            }
            case 'invalid_value':
              if (1 === e.values.length) return `Invalid input: expected ${eK(e.values[0])}`
              return `Invalid option: expected one of ${eF(e.values, '|')}`
            case 'too_big': {
              let t = e.inclusive ? '<=' : '<',
                n = r[e.origin] ?? null
              if (n)
                return `Too big: expected ${e.origin ?? 'value'} to have ${t}${e.maximum.toString()} ${n.unit ?? 'elements'}`
              return `Too big: expected ${e.origin ?? 'value'} to be ${t}${e.maximum.toString()}`
            }
            case 'too_small': {
              let t = e.inclusive ? '>=' : '>',
                n = r[e.origin] ?? null
              if (n)
                return `Too small: expected ${e.origin} to have ${t}${e.minimum.toString()} ${n.unit}`
              return `Too small: expected ${e.origin} to be ${t}${e.minimum.toString()}`
            }
            case 'invalid_format':
              if ('starts_with' === e.format) return `Invalid string: must start with "${e.prefix}"`
              if ('ends_with' === e.format) return `Invalid string: must end with "${e.suffix}"`
              if ('includes' === e.format) return `Invalid string: must include "${e.includes}"`
              if ('regex' === e.format) return `Invalid string: must match pattern ${e.pattern}`
              return `Invalid ${o[e.format] ?? e.format}`
            case 'not_multiple_of':
              return `Invalid number: must be a multiple of ${e.divisor}`
            case 'unrecognized_keys':
              return `Unrecognized key${e.keys.length > 1 ? 's' : ''}: ${eF(e.keys, ', ')}`
            case 'invalid_key':
              return `Invalid key in ${e.origin}`
            case 'invalid_union':
            default:
              return 'Invalid input'
            case 'invalid_element':
              return `Invalid value in ${e.origin}`
          }
        }),
    })
    let im = new (class {
      name = '@contentful/optimization'
      PREFIX_PARTS = ['Ctfl', 'O10n']
      DELIMITER = ':'
      sinks = []
      assembleLocationPrefix(e) {
        return `[${[...this.PREFIX_PARTS, e].join(this.DELIMITER)}]`
      }
      addSink(e) {
        this.sinks = [...this.sinks.filter((t) => t.name !== e.name), e]
      }
      removeSink(e) {
        this.sinks = this.sinks.filter((t) => t.name !== e)
      }
      removeSinks() {
        this.sinks = []
      }
      debug(e, t, ...n) {
        this.emit('debug', e, t, ...n)
      }
      info(e, t, ...n) {
        this.emit('info', e, t, ...n)
      }
      log(e, t, ...n) {
        this.emit('log', e, t, ...n)
      }
      warn(e, t, ...n) {
        this.emit('warn', e, t, ...n)
      }
      error(e, t, ...n) {
        this.emit('error', e, t, ...n)
      }
      fatal(e, t, ...n) {
        this.emit('fatal', e, t, ...n)
      }
      emit(e, t, n, ...i) {
        this.onLogEvent({
          name: this.name,
          level: e,
          messages: [`${this.assembleLocationPrefix(t)} ${String(n)}`, ...i],
        })
      }
      onLogEvent(e) {
        this.sinks.forEach((t) => {
          t.ingest(e)
        })
      }
    })()
    function ib(e) {
      return {
        debug: (t, ...n) => {
          im.debug(e, t, ...n)
        },
        info: (t, ...n) => {
          im.info(e, t, ...n)
        },
        log: (t, ...n) => {
          im.log(e, t, ...n)
        },
        warn: (t, ...n) => {
          im.warn(e, t, ...n)
        },
        error: (t, ...n) => {
          im.error(e, t, ...n)
        },
        fatal: (t, ...n) => {
          im.fatal(e, t, ...n)
        },
      }
    }
    let iw = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, log: 10 },
      i_ = class {},
      iz = {
        debug: (...e) => {
          console.debug(...e)
        },
        info: (...e) => {
          console.info(...e)
        },
        log: (...e) => {
          console.log(...e)
        },
        warn: (...e) => {
          console.warn(...e)
        },
        error: (...e) => {
          console.error(...e)
        },
        fatal: (...e) => {
          console.error(...e)
        },
      }
    class ik extends i_ {
      name = 'ConsoleLogSink'
      verbosity
      constructor(e) {
        ;(super(), (this.verbosity = e ?? 'error'))
      }
      ingest(e) {
        iw[e.level] < iw[this.verbosity] || iz[e.level](...e.messages)
      }
    }
    function iO(e, t) {
      return function (n, i) {
        let r,
          o =
            'string' == typeof (r = i.name)
              ? r
              : 'symbol' == typeof r
                ? (r.description ?? String(r))
                : String(r)
        i.addInitializer(function () {
          let n = Reflect.get(this, i.name)
          if ('function' != typeof n) return
          let r = '[object AsyncFunction]' === Object.prototype.toString.call(n)
          Reflect.set(this, i.name, function (...i) {
            let s
            return ((s = !!((t) => {
              let { [e]: n } = t
              if ('function' != typeof n)
                throw TypeError(
                  `@guardedBy expects predicate "${String(e)}" to be a synchronous function.`,
                )
              return n
            })(this).call(this, o, i)),
            t?.invert === !0 ? !s : s)
              ? n.call(this, ...i)
              : (((e, n) => {
                  let { onBlocked: i } = t ?? {}
                  if (void 0 !== i) {
                    if ('function' == typeof i) return i.call(e, o, n)
                    if ('string' == typeof i || 'symbol' == typeof i) {
                      let { [i]: t } = e
                      'function' == typeof t && t.call(e, o, n)
                    }
                  }
                })(this, i),
                r ? Promise.resolve(void 0) : void 0)
          })
        })
      }
    }
    let iS = (e, t) => (!Number.isFinite(e) || void 0 === e || e < 1 ? t : Math.floor(e)),
      i$ = {
        baseBackoffMs: 500,
        maxBackoffMs: 3e4,
        jitterRatio: 0.2,
        maxConsecutiveFailures: 8,
        circuitOpenMs: 12e4,
      },
      iE = (e, t = i$) => {
        var n, i
        let r = iS(e?.baseBackoffMs, t.baseBackoffMs),
          o = Math.max(r, iS(e?.maxBackoffMs, t.maxBackoffMs))
        return {
          baseBackoffMs: r,
          maxBackoffMs: o,
          jitterRatio:
            ((n = e?.jitterRatio),
            (i = t.jitterRatio),
            Number.isFinite(n) && void 0 !== n ? Math.min(1, Math.max(0, n)) : i),
          maxConsecutiveFailures: iS(e?.maxConsecutiveFailures, t.maxConsecutiveFailures),
          circuitOpenMs: iS(e?.circuitOpenMs, t.circuitOpenMs),
          onCircuitOpen: e?.onCircuitOpen,
          onFlushFailure: e?.onFlushFailure,
          onFlushRecovered: e?.onFlushRecovered,
        }
      }
    class iP {
      circuitOpenUntil = 0
      flushFailureCount = 0
      flushInFlight = !1
      nextFlushAllowedAt = 0
      onCallbackError
      onRetry
      policy
      retryTimer
      constructor(e) {
        const { onCallbackError: t, onRetry: n, policy: i } = e
        ;((this.policy = i), (this.onRetry = n), (this.onCallbackError = t))
      }
      reset() {
        ;(this.clearScheduledRetry(),
          (this.circuitOpenUntil = 0),
          (this.flushFailureCount = 0),
          (this.flushInFlight = !1),
          (this.nextFlushAllowedAt = 0))
      }
      clearScheduledRetry() {
        void 0 !== this.retryTimer && (clearTimeout(this.retryTimer), (this.retryTimer = void 0))
      }
      shouldSkip(e) {
        let { force: t, isOnline: n } = e
        if (this.flushInFlight) return !0
        if (t) return !1
        if (!n) return !0
        let i = Date.now()
        return !!(this.nextFlushAllowedAt > i) || !!(this.circuitOpenUntil > i)
      }
      markFlushStarted() {
        this.flushInFlight = !0
      }
      markFlushFinished() {
        this.flushInFlight = !1
      }
      handleFlushSuccess() {
        let { flushFailureCount: e } = this
        ;(this.clearScheduledRetry(),
          (this.circuitOpenUntil = 0),
          (this.flushFailureCount = 0),
          (this.nextFlushAllowedAt = 0),
          e <= 0 || this.safeInvoke('onFlushRecovered', { consecutiveFailures: e }))
      }
      handleFlushFailure(e) {
        let { queuedBatches: t, queuedEvents: n } = e
        this.flushFailureCount += 1
        let i = ((e) => {
            let {
                consecutiveFailures: t,
                policy: { baseBackoffMs: n, jitterRatio: i, maxBackoffMs: r },
              } = e,
              o = Math.min(r, n * 2 ** Math.max(0, t - 1)),
              s = o * i * Math.random()
            return Math.round(o + s)
          })({ consecutiveFailures: this.flushFailureCount, policy: this.policy }),
          r = Date.now(),
          o = {
            consecutiveFailures: this.flushFailureCount,
            queuedBatches: t,
            queuedEvents: n,
            retryDelayMs: i,
          }
        this.safeInvoke('onFlushFailure', o)
        let {
          circuitOpenUntil: s,
          nextFlushAllowedAt: a,
          openedCircuit: l,
          retryDelayMs: u,
        } = ((e) => {
          let {
            consecutiveFailures: t,
            failureTimestamp: n,
            retryDelayMs: i,
            policy: { maxConsecutiveFailures: r, circuitOpenMs: o },
          } = e
          if (t < r)
            return {
              openedCircuit: !1,
              retryDelayMs: i,
              nextFlushAllowedAt: n + i,
              circuitOpenUntil: 0,
            }
          let s = n + o
          return { openedCircuit: !0, retryDelayMs: o, nextFlushAllowedAt: s, circuitOpenUntil: s }
        })({
          consecutiveFailures: this.flushFailureCount,
          failureTimestamp: r,
          retryDelayMs: i,
          policy: this.policy,
        })
        ;((this.nextFlushAllowedAt = a),
          l &&
            ((this.circuitOpenUntil = s),
            this.safeInvoke('onCircuitOpen', { ...o, retryDelayMs: u })),
          this.scheduleRetry(u))
      }
      scheduleRetry(e) {
        ;(this.clearScheduledRetry(),
          (this.retryTimer = setTimeout(() => {
            ;((this.retryTimer = void 0), this.onRetry())
          }, e)))
      }
      safeInvoke(...e) {
        let [t, n] = e
        try {
          if ('onFlushRecovered' === t) return void this.policy.onFlushRecovered?.(n)
          if ('onCircuitOpen' === t) return void this.policy.onCircuitOpen?.(n)
          this.policy.onFlushFailure?.(n)
        } catch (e) {
          this.onCallbackError?.(t, e)
        }
      }
    }
    let ix = ib('ProductBase'),
      ij = ['identify', 'page', 'screen'],
      iI = class {
        allowedEventTypes
        eventBuilder
        api
        interceptors
        onEventBlocked
        constructor(e) {
          const { api: t, eventBuilder: n, config: i, interceptors: r } = e
          ;((this.allowedEventTypes = i?.allowedEventTypes ?? ij),
            (this.api = t),
            (this.eventBuilder = n),
            (this.interceptors = r),
            (this.onEventBlocked = i?.onEventBlocked))
        }
        reportBlockedEvent(e, t, n, i) {
          let r = { reason: e, product: t, method: n, args: i }
          try {
            this.onEventBlocked?.(r)
          } catch (e) {
            ix.warn(`onEventBlocked callback failed for method "${n}"`, e)
          }
          ew.value = r
        }
      },
      iT = class extends iI {}
    function iA(e, t, n, i) {
      return (iA = (function () {
        function e(e, t) {
          return function (i) {
            ;((function (e, t) {
              if (e.v) throw Error('attempted to call ' + t + ' after decoration was finished')
            })(t, 'addInitializer'),
              n(i, 'An initializer'),
              e.push(i))
          }
        }
        function t(t, n, i, r, o, s, a, l, u) {
          switch (o) {
            case 1:
              c = 'accessor'
              break
            case 2:
              c = 'method'
              break
            case 3:
              c = 'getter'
              break
            case 4:
              c = 'setter'
              break
            default:
              c = 'field'
          }
          var c,
            d,
            f,
            p = { kind: c, name: a ? '#' + n : n, static: s, private: a, metadata: l },
            h = { v: !1 }
          ;((p.addInitializer = e(r, h)),
            0 === o
              ? a
                ? ((d = i.get), (f = i.set))
                : ((d = function () {
                    return this[n]
                  }),
                  (f = function (e) {
                    this[n] = e
                  }))
              : 2 === o
                ? (d = function () {
                    return i.value
                  })
                : ((1 === o || 3 === o) &&
                    (d = function () {
                      return i.get.call(this)
                    }),
                  (1 === o || 4 === o) &&
                    (f = function (e) {
                      i.set.call(this, e)
                    })),
            (p.access = d && f ? { get: d, set: f } : d ? { get: d } : { set: f }))
          try {
            return t(u, p)
          } finally {
            h.v = !0
          }
        }
        function n(e, t) {
          if ('function' != typeof e) throw TypeError(t + ' must be a function')
        }
        function i(e, t) {
          var i = typeof t
          if (1 === e) {
            if ('object' !== i || null === t)
              throw TypeError(
                'accessor decorators must return an object with get, set, or init properties or void 0',
              )
            ;(void 0 !== t.get && n(t.get, 'accessor.get'),
              void 0 !== t.set && n(t.set, 'accessor.set'),
              void 0 !== t.init && n(t.init, 'accessor.init'))
          } else if ('function' !== i)
            throw TypeError(
              (0 === e ? 'field' : 10 === e ? 'class' : 'method') +
                ' decorators must return a function or void 0',
            )
        }
        function r(e, t) {
          t &&
            e.push(function (e) {
              for (var n = 0; n < t.length; n++) t[n].call(e)
              return e
            })
        }
        function o(e, t) {
          return Object.defineProperty(e, Symbol.metadata || Symbol.for('Symbol.metadata'), {
            configurable: !0,
            enumerable: !0,
            value: t,
          })
        }
        return function (n, s, a, l) {
          if (void 0 !== l) var u = l[Symbol.metadata || Symbol.for('Symbol.metadata')]
          var c = Object.create(void 0 === u ? null : u),
            d = (function (e, n, o) {
              for (var s = [], a = new Map(), l = new Map(), u = 0; u < n.length; u++) {
                var c,
                  d,
                  f,
                  p,
                  h = n[u]
                if (Array.isArray(h)) {
                  var v = h[1],
                    y = h[2],
                    g = h.length > 3,
                    m = v >= 5
                  if (
                    (m
                      ? ((f = e), (v -= 5), (p = d = d || []))
                      : ((f = e.prototype), (p = c = c || [])),
                    0 !== v && !g)
                  ) {
                    var b = m ? l : a,
                      w = b.get(y) || 0
                    if (!0 === w || (3 === w && 4 !== v) || (4 === w && 3 !== v))
                      throw Error(
                        'Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: ' +
                          y,
                      )
                    !w && v > 2 ? b.set(y, v) : b.set(y, !0)
                  }
                  !(function (e, n, r, o, s, a, l, u, c) {
                    var d,
                      f,
                      p,
                      h,
                      v,
                      y,
                      g = r[0]
                    if (
                      (l
                        ? (d =
                            0 === s || 1 === s
                              ? { get: r[3], set: r[4] }
                              : 3 === s
                                ? { get: r[3] }
                                : 4 === s
                                  ? { set: r[3] }
                                  : { value: r[3] })
                        : 0 !== s && (d = Object.getOwnPropertyDescriptor(n, o)),
                      1 === s
                        ? (p = { get: d.get, set: d.set })
                        : 2 === s
                          ? (p = d.value)
                          : 3 === s
                            ? (p = d.get)
                            : 4 === s && (p = d.set),
                      'function' == typeof g)
                    )
                      void 0 !== (h = t(g, o, d, u, s, a, l, c, p)) &&
                        (i(s, h),
                        0 === s
                          ? (f = h)
                          : 1 === s
                            ? ((f = h.init),
                              (p = { get: (v = h.get || p.get), set: h.set || p.set }))
                            : (p = h))
                    else
                      for (var m = g.length - 1; m >= 0; m--)
                        void 0 !== (h = t(g[m], o, d, u, s, a, l, c, p)) &&
                          (i(s, h),
                          0 === s
                            ? (y = h)
                            : 1 === s
                              ? ((y = h.init),
                                (p = { get: (v = h.get || p.get), set: h.set || p.set }))
                              : (p = h),
                          void 0 !== y &&
                            (void 0 === f
                              ? (f = y)
                              : 'function' == typeof f
                                ? (f = [f, y])
                                : f.push(y)))
                    if (0 === s || 1 === s) {
                      if (void 0 === f)
                        f = function (e, t) {
                          return t
                        }
                      else if ('function' != typeof f) {
                        var b = f
                        f = function (e, t) {
                          for (var n = t, i = 0; i < b.length; i++) n = b[i].call(e, n)
                          return n
                        }
                      } else {
                        var w = f
                        f = function (e, t) {
                          return w.call(e, t)
                        }
                      }
                      e.push(f)
                    }
                    0 !== s &&
                      (1 === s
                        ? ((d.get = p.get), (d.set = p.set))
                        : 2 === s
                          ? (d.value = p)
                          : 3 === s
                            ? (d.get = p)
                            : 4 === s && (d.set = p),
                      l
                        ? 1 === s
                          ? (e.push(function (e, t) {
                              return p.get.call(e, t)
                            }),
                            e.push(function (e, t) {
                              return p.set.call(e, t)
                            }))
                          : 2 === s
                            ? e.push(p)
                            : e.push(function (e, t) {
                                return p.call(e, t)
                              })
                        : Object.defineProperty(n, o, d))
                  })(s, f, h, y, v, m, g, p, o)
                }
              }
              return (r(s, c), r(s, d), s)
            })(n, s, c)
          return (
            a.length || o(n, c),
            {
              e: d,
              get c() {
                return (function (t, n, r) {
                  if (n.length > 0) {
                    for (var s = [], a = t, l = t.name, u = n.length - 1; u >= 0; u--) {
                      var c = { v: !1 }
                      try {
                        var d = n[u](a, {
                          kind: 'class',
                          name: l,
                          addInitializer: e(s, c),
                          metadata: r,
                        })
                      } finally {
                        c.v = !0
                      }
                      void 0 !== d && (i(10, d), (a = d))
                    }
                    return [
                      o(a, r),
                      function () {
                        for (var e = 0; e < s.length; e++) s[e].call(a)
                      },
                    ]
                  }
                })(n, a, c)
              },
            }
          )
        }
      })())(e, t, n, i)
    }
    let iB = ib('Analytics'),
      iF = {
        trackView: 'component',
        trackFlagView: 'component',
        trackClick: 'component_click',
        trackHover: 'component_hover',
      }
    ;((l = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (u = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (c = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (d = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })))
    class iC extends iT {
      static {
        ;({
          e: [f],
        } = iA(
          this,
          [
            [l, 2, 'trackView'],
            [u, 2, 'trackClick'],
            [c, 2, 'trackHover'],
            [d, 2, 'trackFlagView'],
          ],
          [],
        ))
      }
      queue = (f(this), new Map())
      flushRuntime
      states = { blockedEventStream: eg(ew), eventStream: eg(ez), profile: eg(eP) }
      constructor(e) {
        const { api: t, eventBuilder: n, config: i, interceptors: r } = e
        ;(super({ api: t, eventBuilder: n, config: i, interceptors: r }),
          this.applyDefaults(i?.defaults),
          (this.flushRuntime = new iP({
            policy: iE(i?.queuePolicy),
            onRetry: () => {
              this.flush()
            },
            onCallbackError: (e, t) => {
              iB.warn(`Analytics flush policy callback "${e}" failed`, t)
            },
          })),
          this.initializeEffects())
      }
      reset() {
        ;(this.flushRuntime.reset(),
          k(() => {
            ;((ew.value = void 0), (ez.value = void 0), (eP.value = void 0))
          }))
      }
      hasConsent(e) {
        let t = iF[e] ?? e
        return !!e_.value || (this.allowedEventTypes ?? []).includes(t)
      }
      onBlockedByConsent(e, t) {
        ;(iB.warn(`Event "${e}" was blocked due to lack of consent; payload: ${JSON.stringify(t)}`),
          this.reportBlockedEvent('consent', 'analytics', e, t))
      }
      async trackView(e) {
        ;(iB.info(`Processing "component view" event for ${e.componentId}`),
          await this.enqueueEvent(this.eventBuilder.buildView(e)))
      }
      async trackClick(e) {
        ;(iB.info(`Processing "component click" event for ${e.componentId}`),
          await this.enqueueEvent(this.eventBuilder.buildClick(e)))
      }
      async trackHover(e) {
        ;(iB.info(`Processing "component hover" event for ${e.componentId}`),
          await this.enqueueEvent(this.eventBuilder.buildHover(e)))
      }
      async trackFlagView(e) {
        ;(iB.debug(`Processing "flag view" event for ${e.componentId}`),
          await this.enqueueEvent(this.eventBuilder.buildFlagView(e)))
      }
      async enqueueEvent(e) {
        let { value: t } = eP
        if (!t) return void iB.warn('Attempting to emit an event without an Optimization profile')
        let n = ig(ih, await this.interceptors.event.run(e))
        iB.debug(`Queueing ${n.type} event for profile ${t.id}`, n)
        let { id: i } = t,
          r = this.queue.get(i)
        ;((ez.value = n),
          r ? ((r.profile = t), r.events.push(n)) : this.queue.set(i, { profile: t, events: [n] }),
          await this.flushMaxEvents())
      }
      async flushMaxEvents() {
        this.getQueuedEventCount() >= 25 && (await this.flush())
      }
      async flush(e = {}) {
        let { force: t = !1 } = e
        if (this.flushRuntime.shouldSkip({ force: t, isOnline: !!ek.value })) return
        iB.debug('Flushing event queue')
        let n = this.createBatches()
        if (!n.length) return void this.flushRuntime.clearScheduledRetry()
        this.flushRuntime.markFlushStarted()
        try {
          ;(await this.trySendBatches(n))
            ? (this.queue.clear(), this.flushRuntime.handleFlushSuccess())
            : this.flushRuntime.handleFlushFailure({
                queuedBatches: n.length,
                queuedEvents: this.getQueuedEventCount(),
              })
        } finally {
          this.flushRuntime.markFlushFinished()
        }
      }
      applyDefaults(e) {
        if (e?.profile === void 0) return
        let { profile: t } = e
        eP.value = t
      }
      initializeEffects() {
        ;(D(() => {
          let e = eP.value?.id
          ;(iB.info(
            `Analytics ${e_.value ? 'will' : 'will not'} be collected due to consent (${e_.value})`,
          ),
            iB.debug(`Profile ${e && `with ID ${e}`} has been ${e ? 'set' : 'cleared'}`))
        }),
          D(() => {
            ek.value && (this.flushRuntime.clearScheduledRetry(), this.flush({ force: !0 }))
          }))
      }
      createBatches() {
        let e = []
        return (
          this.queue.forEach(({ profile: t, events: n }) => {
            e.push({ profile: t, events: n })
          }),
          e
        )
      }
      async trySendBatches(e) {
        try {
          return await this.api.insights.sendBatchEvents(e)
        } catch (e) {
          return (iB.warn('Analytics queue flush request threw an error', e), !1)
        }
      }
      getQueuedEventCount() {
        let e = 0
        return (
          this.queue.forEach(({ events: t }) => {
            e += t.length
          }),
          e
        )
      }
    }
    ib('Analytics')
    let iR = ib('ApiClient:Retry')
    class iq extends Error {
      status
      constructor(e, t = 500) {
        ;(super(e), Object.setPrototypeOf(this, iq.prototype), (this.status = t))
      }
    }
    async function iM(e) {
      if (e <= 0) return
      let { promise: t, resolve: n } = Promise.withResolvers()
      ;(setTimeout(() => {
        n(void 0)
      }, e),
        await t)
    }
    let iU = ib('ApiClient:Timeout'),
      iV = ib('ApiClient:Fetch'),
      iZ = function (e) {
        try {
          let t = (function ({
            apiName: e = 'Optimization',
            fetchMethod: t = fetch,
            onRequestTimeout: n,
            requestTimeout: i = 3e3,
          } = {}) {
            return async (r, o) => {
              let s = new AbortController(),
                a = setTimeout(() => {
                  ;('function' == typeof n
                    ? n({ apiName: e })
                    : iU.error(`Request to "${r.toString()}" timed out`, Error('Request timeout')),
                    s.abort())
                }, i),
                l = await t(r, { ...o, signal: s.signal })
              return (clearTimeout(a), l)
            }
          })(e)
          return (function ({
            apiName: e = 'Optimization',
            fetchMethod: t = fetch,
            intervalTimeout: n = 0,
            onFailedAttempt: i,
            retries: r = 1,
          } = {}) {
            return async (o, s) => {
              let a = new AbortController(),
                l = r + 1,
                u = (function ({
                  apiName: e = 'Optimization',
                  controller: t,
                  fetchMethod: n = fetch,
                  init: i,
                  url: r,
                }) {
                  return async () => {
                    try {
                      let o = await n(r, i)
                      if (503 === o.status)
                        throw new iq(
                          `${e} API request to "${r.toString()}" failed with status: "[${o.status}] ${o.statusText}".`,
                          503,
                        )
                      if (!o.ok) {
                        let e = Error(
                          `Request to "${r.toString()}" failed with status: [${o.status}] ${o.statusText} - traceparent: ${o.headers.get('traceparent')}`,
                        )
                        ;(iR.error('Request failed with non-OK status:', e), t.abort())
                        return
                      }
                      return (iR.debug(`Response from "${r.toString()}":`, o), o)
                    } catch (e) {
                      if (e instanceof iq && 503 === e.status) throw e
                      ;(iR.error(`Request to "${r.toString()}" failed:`, e), t.abort())
                    }
                  }
                })({ apiName: e, controller: a, fetchMethod: t, init: s, url: o })
              for (let t = 1; t <= l; t++)
                try {
                  let e = await u()
                  if (e) return e
                  break
                } catch (o) {
                  if (!(o instanceof iq) || 503 !== o.status) throw o
                  let r = l - t
                  if ((i?.({ apiName: e, error: o, attemptNumber: t, retriesLeft: r }), 0 === r))
                    throw o
                  await iM(n)
                }
              throw Error(`${e} API request to "${o.toString()}" may not be retried.`)
            }
          })({ ...e, fetchMethod: t })
        } catch (e) {
          throw (
            e instanceof Error &&
              ('AbortError' === e.name
                ? iV.warn('Request aborted due to network issues. This request may not be retried.')
                : iV.error('Request failed:', e)),
            e
          )
        }
      },
      iD = ib('ApiClient'),
      iN = class {
        name
        clientId
        environment
        fetch
        constructor(e, { fetchOptions: t, clientId: n, environment: i }) {
          ;((this.clientId = n),
            (this.environment = i ?? 'main'),
            (this.name = e),
            (this.fetch = iZ({ ...(t ?? {}), apiName: e })))
        }
        logRequestError(e, { requestName: t }) {
          e instanceof Error &&
            ('AbortError' === e.name
              ? iD.warn(
                  `[${this.name}] "${t}" request aborted due to network issues. This request may not be retried.`,
                )
              : iD.error(`[${this.name}] "${t}" request failed:`, e))
        }
      },
      iL = ib('ApiClient:Experience'),
      iQ = class extends iN {
        baseUrl
        enabledFeatures
        ip
        locale
        plainText
        preflight
        constructor(e) {
          super('Experience', e)
          const { baseUrl: t, enabledFeatures: n, ip: i, locale: r, plainText: o, preflight: s } = e
          ;((this.baseUrl = t || 'https://experience.ninetailed.co/'),
            (this.enabledFeatures = n),
            (this.ip = i),
            (this.locale = r),
            (this.plainText = o),
            (this.preflight = s))
        }
        async getProfile(e, t = {}) {
          if (!e) throw Error('Valid profile ID required.')
          let n = 'Get Profile'
          iL.info(`Sending "${n}" request`)
          try {
            let i = await this.fetch(
                this.constructUrl(
                  `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${e}`,
                  t,
                ),
                { method: 'GET' },
              ),
              {
                data: { changes: r, experiences: o, profile: s },
              } = ig(ip, await i.json())
            return (
              iL.debug(`"${n}" request successfully completed`),
              { changes: r, selectedPersonalizations: o, profile: s }
            )
          } catch (e) {
            throw (this.logRequestError(e, { requestName: n }), e)
          }
        }
        async makeProfileMutationRequest({ url: e, body: t, options: n }) {
          return await this.fetch(this.constructUrl(e, n), {
            method: 'POST',
            headers: this.constructHeaders(n),
            body: JSON.stringify(t),
            keepalive: !0,
          })
        }
        async createProfile({ events: e }, t = {}) {
          let n = 'Create Profile'
          iL.info(`Sending "${n}" request`)
          let i = this.constructExperienceRequestBody(e, t)
          iL.debug(`"${n}" request body:`, i)
          try {
            let e = await this.makeProfileMutationRequest({
                url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles`,
                body: i,
                options: t,
              }),
              {
                data: { changes: r, experiences: o, profile: s },
              } = ig(ip, await e.json())
            return (
              iL.debug(`"${n}" request successfully completed`),
              { changes: r, selectedPersonalizations: o, profile: s }
            )
          } catch (e) {
            throw (this.logRequestError(e, { requestName: n }), e)
          }
        }
        async updateProfile({ profileId: e, events: t }, n = {}) {
          if (!e) throw Error('Valid profile ID required.')
          let i = 'Update Profile'
          iL.info(`Sending "${i}" request`)
          let r = this.constructExperienceRequestBody(t, n)
          iL.debug(`"${i}" request body:`, r)
          try {
            let t = await this.makeProfileMutationRequest({
                url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${e}`,
                body: r,
                options: n,
              }),
              {
                data: { changes: o, experiences: s, profile: a },
              } = ig(ip, await t.json())
            return (
              iL.debug(`"${i}" request successfully completed`),
              { changes: o, selectedPersonalizations: s, profile: a }
            )
          } catch (e) {
            throw (this.logRequestError(e, { requestName: i }), e)
          }
        }
        async upsertProfile({ profileId: e, events: t }, n) {
          return e
            ? await this.updateProfile({ profileId: e, events: t }, n)
            : await this.createProfile({ events: t }, n)
        }
        async upsertManyProfiles({ events: e }, t = {}) {
          let n = 'Upsert Many Profiles'
          iL.info(`Sending "${n}" request`)
          let i = ig(it, { events: e, options: this.constructBodyOptions(t) })
          iL.debug(`"${n}" request body:`, i)
          try {
            let e = await this.makeProfileMutationRequest({
                url: `v2/organizations/${this.clientId}/environments/${this.environment}/events`,
                body: i,
                options: { plainText: !1, ...t },
              }),
              {
                data: { profiles: r },
              } = ig(ia, await e.json())
            return (iL.debug(`"${n}" request successfully completed`), r)
          } catch (e) {
            throw (this.logRequestError(e, { requestName: n }), e)
          }
        }
        constructUrl(e, t) {
          let n = new URL(e, this.baseUrl),
            i = t.locale ?? this.locale,
            r = t.preflight ?? this.preflight
          return (
            i && n.searchParams.set('locale', i),
            r && n.searchParams.set('type', 'preflight'),
            n.toString()
          )
        }
        constructHeaders({ ip: e = this.ip, plainText: t = this.plainText }) {
          let n = new Map()
          return (
            e && n.set('X-Force-IP', e),
            (t ?? this.plainText ?? !0)
              ? n.set('Content-Type', 'text/plain')
              : n.set('Content-Type', 'application/json'),
            Object.fromEntries(n)
          )
        }
        constructBodyOptions = ({ enabledFeatures: e = this.enabledFeatures }) => {
          let t = {}
          return (
            e && Array.isArray(e) && e.length > 0
              ? (t.features = e)
              : (t.features = ['ip-enrichment', 'location']),
            t
          )
        }
        constructExperienceRequestBody(e, t) {
          return ie.parse({ events: ig(n9, e), options: this.constructBodyOptions(t) })
        }
      },
      iH = ib('ApiClient:Insights'),
      iJ = class extends iN {
        baseUrl
        beaconHandler
        constructor(e) {
          super('Insights', e)
          const { baseUrl: t, beaconHandler: n } = e
          ;((this.baseUrl = t || 'https://ingest.insights.ninetailed.co/'),
            (this.beaconHandler = n))
        }
        async sendBatchEvents(e, t = {}) {
          let { beaconHandler: n = this.beaconHandler } = t,
            i = new URL(
              `v1/organizations/${this.clientId}/environments/${this.environment}/events`,
              this.baseUrl,
            ),
            r = ig(iy, e)
          if ('function' == typeof n) {
            if ((iH.debug('Queueing events via beaconHandler'), n(i, r))) return !0
            iH.warn(
              'beaconHandler failed to queue events; events will be emitted immediately via fetch',
            )
          }
          let o = 'Event Batches'
          ;(iH.info(`Sending "${o}" request`), iH.debug(`"${o}" request body:`, r))
          try {
            return (
              await this.fetch(i, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(r),
                keepalive: !0,
              }),
              iH.debug(`"${o}" request successfully completed`),
              !0
            )
          } catch (e) {
            return (this.logRequestError(e, { requestName: o }), !1)
          }
        }
      }
    class iW {
      config
      experience
      insights
      constructor(e) {
        const {
            personalization: t,
            analytics: n,
            clientId: i,
            environment: r,
            fetchOptions: o,
          } = e,
          s = { clientId: i, environment: r, fetchOptions: o }
        ;((this.config = s),
          (this.experience = new iQ({ ...s, ...t })),
          (this.insights = new iJ({ ...s, ...n })))
      }
    }
    function iK(e) {
      if (!e || 'object' != typeof e) return !1
      let t = Object.getPrototypeOf(e)
      return (
        (null === t || t === Object.prototype || null === Object.getPrototypeOf(t)) &&
        '[object Object]' === Object.prototype.toString.call(e)
      )
    }
    function iG(e) {
      return iK(e) || Array.isArray(e)
    }
    let iX = tX({
        campaign: nn(nR),
        locale: nn(tq()),
        location: nn(nV),
        page: nn(nD),
        screen: nn(nL),
        userAgent: nn(tq()),
      }),
      iY = tY(iX, { componentId: tq(), experienceId: nn(tq()), variantIndex: nn(tV()) }),
      i0 = tY(iY, { sticky: nn(tD()), viewId: tq(), viewDurationMs: tV() }),
      i1 = tY(iY, { viewId: nn(tq()), viewDurationMs: nn(tV()) }),
      i2 = tY(iY, { hoverId: tq(), hoverDurationMs: tV() }),
      i3 = tY(iX, { traits: nn(nQ), userId: tq() }),
      i4 = tY(iX, {
        properties: nn(
          (function (e, t) {
            var n = void 0
            let i = e._zod.def.checks
            if (i && i.length > 0)
              throw Error('.partial() cannot be used on object schemas containing refinements')
            let r = eZ(e._zod.def, {
              get shape() {
                let t = e._zod.def.shape,
                  i = { ...t }
                if (n)
                  for (let e in n) {
                    if (!(e in t)) throw Error(`Unrecognized key: "${e}"`)
                    n[e] && (i[e] = nt ? new nt({ type: 'optional', innerType: t[e] }) : t[e])
                  }
                else
                  for (let e in t) i[e] = nt ? new nt({ type: 'optional', innerType: t[e] }) : t[e]
                return (eV(this, 'shape', i), i)
              },
              checks: [],
            })
            return eJ(e, r)
          })(nD),
        ),
      }),
      i6 = tY(iX, { name: tq(), properties: nN }),
      i5 = tY(iX, { event: tq(), properties: nn(ns(nN, {})) }),
      i8 = { path: '', query: {}, referrer: '', search: '', title: '', url: '' },
      i9 = class {
        app
        channel
        library
        getLocale
        getPageProperties
        getUserAgent
        constructor(e) {
          const {
            app: t,
            channel: n,
            library: i,
            getLocale: r,
            getPageProperties: o,
            getUserAgent: s,
          } = e
          ;((this.app = t),
            (this.channel = n),
            (this.library = i),
            (this.getLocale = r ?? (() => 'en-US')),
            (this.getPageProperties = o ?? (() => i8)),
            (this.getUserAgent = s ?? (() => void 0)))
        }
        buildUniversalEventProperties({
          campaign: e = {},
          locale: t,
          location: n,
          page: i,
          screen: r,
          userAgent: o,
        }) {
          let s = new Date().toISOString()
          return {
            channel: this.channel,
            context: {
              app: this.app,
              campaign: e,
              gdpr: { isConsentGiven: !0 },
              library: this.library,
              locale: t ?? this.getLocale() ?? 'en-US',
              location: n,
              page: i ?? this.getPageProperties(),
              screen: r,
              userAgent: o ?? this.getUserAgent(),
            },
            messageId: crypto.randomUUID(),
            originalTimestamp: s,
            sentAt: s,
            timestamp: s,
          }
        }
        buildEntryComponentBase(e, t, n, i) {
          return {
            ...this.buildUniversalEventProperties(e),
            componentType: 'Entry',
            componentId: t,
            experienceId: n,
            variantIndex: i ?? 0,
          }
        }
        buildView(e) {
          let {
            componentId: t,
            viewId: n,
            experienceId: i,
            variantIndex: r,
            viewDurationMs: o,
            ...s
          } = ig(i0, e)
          return {
            ...this.buildEntryComponentBase(s, t, i, r),
            type: 'component',
            viewId: n,
            viewDurationMs: o,
          }
        }
        buildClick(e) {
          let { componentId: t, experienceId: n, variantIndex: i, ...r } = ig(iY, e)
          return { ...this.buildEntryComponentBase(r, t, n, i), type: 'component_click' }
        }
        buildHover(e) {
          let {
            hoverId: t,
            componentId: n,
            experienceId: i,
            hoverDurationMs: r,
            variantIndex: o,
            ...s
          } = ig(i2, e)
          return {
            ...this.buildEntryComponentBase(s, n, i, o),
            type: 'component_hover',
            hoverId: t,
            hoverDurationMs: r,
          }
        }
        buildFlagView(e) {
          let {
            componentId: t,
            experienceId: n,
            variantIndex: i,
            viewId: r,
            viewDurationMs: o,
            ...s
          } = ig(i1, e)
          return {
            ...this.buildEntryComponentBase(s, t, n, i),
            ...(void 0 === o ? {} : { viewDurationMs: o }),
            ...(void 0 === r ? {} : { viewId: r }),
            type: 'component',
            componentType: 'Variable',
          }
        }
        buildIdentify(e) {
          let { traits: t = {}, userId: n, ...i } = ig(i3, e)
          return {
            ...this.buildUniversalEventProperties(i),
            type: 'identify',
            traits: t,
            userId: n,
          }
        }
        buildPageView(e = {}) {
          let { properties: t = {}, ...n } = ig(i4, e),
            i = this.getPageProperties(),
            r = (function e(t, n) {
              let i = Object.keys(n)
              for (let r = 0; r < i.length; r++) {
                let o = i[r]
                if ('__proto__' === o) continue
                let s = n[o],
                  a = t[o]
                iG(s) && iG(a)
                  ? (t[o] = e(a, s))
                  : Array.isArray(s)
                    ? (t[o] = e([], s))
                    : iK(s)
                      ? (t[o] = e({}, s))
                      : (void 0 === a || void 0 !== s) && (t[o] = s)
              }
              return t
            })({ ...i, title: i.title ?? i8.title }, t),
            {
              context: { screen: o, ...s },
              ...a
            } = this.buildUniversalEventProperties(n),
            l = ig(nX, s)
          return { ...a, context: l, type: 'page', properties: r }
        }
        buildScreenView(e) {
          let { name: t, properties: n, ...i } = ig(i6, e),
            {
              context: { page: r, ...o },
              ...s
            } = this.buildUniversalEventProperties(i),
            a = ig(n0, o)
          return { ...s, context: a, type: 'screen', name: t, properties: n }
        }
        buildTrack(e) {
          let { event: t, properties: n = {}, ...i } = ig(i5, e)
          return {
            ...this.buildUniversalEventProperties(i),
            type: 'track',
            event: t,
            properties: n,
          }
        }
      }
    class i7 {
      interceptors = new Map()
      nextId = 0
      add(e) {
        let { nextId: t } = this
        return ((this.nextId += 1), this.interceptors.set(t, e), t)
      }
      remove(e) {
        return this.interceptors.delete(e)
      }
      clear() {
        this.interceptors.clear()
      }
      count() {
        return this.interceptors.size
      }
      async run(e) {
        let t = Array.from(this.interceptors.values()),
          n = e
        for (let e of t) n = await e(ey(n))
        return n
      }
    }
    class re {
      api
      eventBuilder
      config
      interceptors = { event: new i7(), state: new i7() }
      constructor(e) {
        this.config = e
        const {
          analytics: t,
          personalization: n,
          eventBuilder: i,
          logLevel: r,
          environment: o,
          clientId: s,
          fetchOptions: a,
        } = e
        ;(im.addSink(new ik(r)),
          (this.api = new iW({
            clientId: s,
            environment: o,
            fetchOptions: a,
            analytics: t,
            personalization: n,
          })),
          (this.eventBuilder = new i9(
            i ?? {
              channel: 'server',
              library: { name: '@contentful/optimization-ios-bridge', version: '0.0.0' },
            },
          )))
      }
      get flagsResolver() {
        return this._personalization.flagsResolver
      }
      get mergeTagValueResolver() {
        return this._personalization.mergeTagValueResolver
      }
      get personalizedEntryResolver() {
        return this._personalization.personalizedEntryResolver
      }
      getFlag(e, t) {
        return this._personalization.getFlag(e, t)
      }
      personalizeEntry(e, t) {
        return this._personalization.personalizeEntry(e, t)
      }
      getMergeTagValue(e, t) {
        return this._personalization.getMergeTagValue(e, t)
      }
      async identify(e) {
        return await this._personalization.identify(e)
      }
      async page(e) {
        return await this._personalization.page(e)
      }
      async screen(e) {
        return await this._personalization.screen(e)
      }
      async track(e) {
        return await this._personalization.track(e)
      }
      async trackView(e) {
        let t
        return (
          e.sticky && (t = await this._personalization.trackView(e)),
          await this._analytics.trackView(e),
          t
        )
      }
      async trackClick(e) {
        await this._analytics.trackClick(e)
      }
      async trackHover(e) {
        await this._analytics.trackHover(e)
      }
      async trackFlagView(e) {
        await this._analytics.trackFlagView(e)
      }
    }
    let rt = re
    function rn() {}
    function ri(e, t) {
      return (function e(t, n, i, r, o, s, a) {
        let l = a(t, n, i, r, o, s)
        if (void 0 !== l) return l
        if (typeof t == typeof n)
          switch (typeof t) {
            case 'bigint':
            case 'string':
            case 'boolean':
            case 'symbol':
            case 'undefined':
            case 'function':
              return t === n
            case 'number':
              return t === n || Object.is(t, n)
          }
        return (function t(n, i, r, o) {
          if (Object.is(n, i)) return !0
          let s = L(n),
            a = L(i)
          if ((s === K && (s = ei), a === K && (a = ei), s !== a)) return !1
          switch (s) {
            case H:
              return n.toString() === i.toString()
            case J: {
              let e = n.valueOf(),
                t = i.valueOf()
              return e === t || (Number.isNaN(e) && Number.isNaN(t))
            }
            case W:
            case X:
            case G:
              return Object.is(n.valueOf(), i.valueOf())
            case Q:
              return n.source === i.source && n.flags === i.flags
            case '[object Function]':
              return n === i
          }
          let l = (r = r ?? new Map()).get(n),
            u = r.get(i)
          if (null != l && null != u) return l === i
          ;(r.set(n, i), r.set(i, n))
          try {
            switch (s) {
              case Y:
                if (n.size !== i.size) return !1
                for (let [t, s] of n.entries())
                  if (!i.has(t) || !e(s, i.get(t), t, n, i, r, o)) return !1
                return !0
              case ee: {
                if (n.size !== i.size) return !1
                let t = Array.from(n.values()),
                  s = Array.from(i.values())
                for (let a = 0; a < t.length; a++) {
                  let l = t[a],
                    u = s.findIndex((t) => e(l, t, void 0, n, i, r, o))
                  if (-1 === u) return !1
                  s.splice(u, 1)
                }
                return !0
              }
              case et:
              case eo:
              case es:
              case ea:
              case el:
              case '[object BigUint64Array]':
              case eu:
              case ec:
              case ed:
              case '[object BigInt64Array]':
              case ef:
              case ep:
                if (
                  ('u' > typeof Buffer && Buffer.isBuffer(n) !== Buffer.isBuffer(i)) ||
                  n.length !== i.length
                )
                  return !1
                for (let t = 0; t < n.length; t++) if (!e(n[t], i[t], t, n, i, r, o)) return !1
                return !0
              case en:
                if (n.byteLength !== i.byteLength) return !1
                return t(new Uint8Array(n), new Uint8Array(i), r, o)
              case er:
                if (n.byteLength !== i.byteLength || n.byteOffset !== i.byteOffset) return !1
                return t(new Uint8Array(n), new Uint8Array(i), r, o)
              case '[object Error]':
                return n.name === i.name && n.message === i.message
              case ei: {
                if (!(t(n.constructor, i.constructor, r, o) || (iK(n) && iK(i)))) return !1
                let s = [...Object.keys(n), ...N(n)],
                  a = [...Object.keys(i), ...N(i)]
                if (s.length !== a.length) return !1
                for (let t = 0; t < s.length; t++) {
                  let a = s[t],
                    l = n[a]
                  if (!Object.hasOwn(i, a)) return !1
                  let u = i[a]
                  if (!e(l, u, a, n, i, r, o)) return !1
                }
                return !0
              }
              default:
                return !1
            }
          } finally {
            ;(r.delete(n), r.delete(i))
          }
        })(t, n, s, a)
      })(e, t, void 0, void 0, void 0, void 0, rn)
    }
    let rr = '__ctfl_optimization_stateful_runtime_lock__',
      ro = () => {
        let e = globalThis
        return ((e[rr] ??= { owner: void 0 }), e[rr])
      },
      rs = (e) => {
        let t = ro()
        t.owner === e && (t.owner = void 0)
      },
      ra = {
        resolve: (e) =>
          e
            ? e.reduce((e, { key: t, value: n }) => {
                let i =
                  'object' == typeof n && null !== n && 'value' in n && 'object' == typeof n.value
                    ? n.value
                    : n
                return ((e[t] = i), e)
              }, {})
            : {},
      },
      rl = ib('Personalization'),
      ru = 'Could not resolve Merge Tag value:',
      rc = (e, t) => {
        if (!e || 'object' != typeof e) return
        if (!t) return e
        let n = e
        for (let e of t.split('.').filter(Boolean)) {
          if (!n || ('object' != typeof n && 'function' != typeof n)) return
          n = Reflect.get(n, e)
        }
        return n
      },
      rd = {
        normalizeSelectors: (e) =>
          e
            .split('_')
            .map((e, t, n) =>
              [n.slice(0, t).join('.'), n.slice(t).join('_')].filter((e) => '' !== e).join('.'),
            ),
        getValueFromProfile(e, t) {
          let n = rd.normalizeSelectors(e).find((e) => rc(t, e))
          if (!n) return
          let i = rc(t, n)
          if (i && ('string' == typeof i || 'number' == typeof i || 'boolean' == typeof i))
            return `${i}`
        },
        resolve(e, t) {
          if (!nz.safeParse(e).success)
            return void rl.warn(`${ru} supplied entry is not a Merge Tag entry`)
          let {
            fields: { nt_fallback: n },
          } = e
          return ir.safeParse(t).success
            ? (rd.getValueFromProfile(e.fields.nt_mergetag_id, t) ?? n)
            : (rl.warn(`${ru} no valid profile`), n)
        },
      },
      rf = ib('Personalization'),
      rp = 'Could not resolve personalized entry variant:',
      rh = {
        getPersonalizationEntry({ personalizedEntry: e, selectedPersonalizations: t }, n = !1) {
          if (n || (t.length && nF(e)))
            return e.fields.nt_experiences
              .filter((e) => nB(e))
              .find((e) => t.some(({ experienceId: t }) => t === e.fields.nt_experience_id))
        },
        getSelectedPersonalization(
          { personalizationEntry: e, selectedPersonalizations: t },
          n = !1,
        ) {
          if (n || (t.length && nB(e)))
            return t.find(({ experienceId: t }) => t === e.fields.nt_experience_id)
        },
        getSelectedVariant(
          { personalizedEntry: e, personalizationEntry: t, selectedVariantIndex: n },
          i = !1,
        ) {
          var r
          if (!i && (!nF(e) || !nB(t))) return
          let o = ((r = t.fields.nt_config),
          {
            distribution: r?.distribution === void 0 ? [] : [...r.distribution],
            traffic: r?.traffic ?? 0,
            components: r?.components === void 0 ? [] : [...r.components],
            sticky: r?.sticky ?? !1,
          }).components
            .filter(
              (e) => ('EntryReplacement' === e.type || void 0 === e.type) && !e.baseline.hidden,
            )
            .find((t) => t.baseline.id === e.sys.id)?.variants
          if (o?.length) return o.at(n - 1)
        },
        getSelectedVariantEntry({ personalizationEntry: e, selectedVariant: t }, n = !1) {
          if (!n && (!nB(e) || !nk.safeParse(t).success)) return
          let i = e.fields.nt_variants?.find((e) => e.sys.id === t.id)
          return nb.safeParse(i).success ? i : void 0
        },
        resolve: function (e, t) {
          if ((rf.debug(`Resolving personalized entry for baseline entry ${e.sys.id}`), !t?.length))
            return (
              rf.warn(`${rp} no selectedPersonalizations exist for the current profile`),
              { entry: e }
            )
          if (!nF(e)) return (rf.warn(`${rp} entry ${e.sys.id} is not personalized`), { entry: e })
          let n = rh.getPersonalizationEntry(
            { personalizedEntry: e, selectedPersonalizations: t },
            !0,
          )
          if (!n)
            return (
              rf.warn(`${rp} could not find a personalization entry for ${e.sys.id}`),
              { entry: e }
            )
          let i = rh.getSelectedPersonalization(
              { personalizationEntry: n, selectedPersonalizations: t },
              !0,
            ),
            r = i?.variantIndex ?? 0
          if (0 === r)
            return (
              rf.debug(`Resolved personalization entry for entry ${e.sys.id} is baseline`),
              { entry: e }
            )
          let o = rh.getSelectedVariant(
            { personalizedEntry: e, personalizationEntry: n, selectedVariantIndex: r },
            !0,
          )
          if (!o)
            return (
              rf.warn(`${rp} could not find a valid replacement variant entry for ${e.sys.id}`),
              { entry: e }
            )
          let s = rh.getSelectedVariantEntry({ personalizationEntry: n, selectedVariant: o }, !0)
          return s
            ? (rf.debug(`Entry ${e.sys.id} has been resolved to variant entry ${s.sys.id}`),
              { entry: s, personalization: i })
            : (rf.warn(`${rp} could not find a valid replacement variant entry for ${e.sys.id}`),
              { entry: e })
        },
      },
      rv = class extends iI {
        flagsResolver = ra
        mergeTagValueResolver = rd
        personalizedEntryResolver = rh
        getFlag(e, t) {
          return this.flagsResolver.resolve(t)[e]
        }
        personalizeEntry(e, t) {
          return rh.resolve(e, t)
        }
        getMergeTagValue(e, t) {
          return rd.resolve(e, t)
        }
      }
    function ry(e, t, n, i) {
      return (ry = (function () {
        function e(e, t) {
          return function (i) {
            ;((function (e, t) {
              if (e.v) throw Error('attempted to call ' + t + ' after decoration was finished')
            })(t, 'addInitializer'),
              n(i, 'An initializer'),
              e.push(i))
          }
        }
        function t(t, n, i, r, o, s, a, l, u) {
          switch (o) {
            case 1:
              c = 'accessor'
              break
            case 2:
              c = 'method'
              break
            case 3:
              c = 'getter'
              break
            case 4:
              c = 'setter'
              break
            default:
              c = 'field'
          }
          var c,
            d,
            f,
            p = { kind: c, name: a ? '#' + n : n, static: s, private: a, metadata: l },
            h = { v: !1 }
          ;((p.addInitializer = e(r, h)),
            0 === o
              ? a
                ? ((d = i.get), (f = i.set))
                : ((d = function () {
                    return this[n]
                  }),
                  (f = function (e) {
                    this[n] = e
                  }))
              : 2 === o
                ? (d = function () {
                    return i.value
                  })
                : ((1 === o || 3 === o) &&
                    (d = function () {
                      return i.get.call(this)
                    }),
                  (1 === o || 4 === o) &&
                    (f = function (e) {
                      i.set.call(this, e)
                    })),
            (p.access = d && f ? { get: d, set: f } : d ? { get: d } : { set: f }))
          try {
            return t(u, p)
          } finally {
            h.v = !0
          }
        }
        function n(e, t) {
          if ('function' != typeof e) throw TypeError(t + ' must be a function')
        }
        function i(e, t) {
          var i = typeof t
          if (1 === e) {
            if ('object' !== i || null === t)
              throw TypeError(
                'accessor decorators must return an object with get, set, or init properties or void 0',
              )
            ;(void 0 !== t.get && n(t.get, 'accessor.get'),
              void 0 !== t.set && n(t.set, 'accessor.set'),
              void 0 !== t.init && n(t.init, 'accessor.init'))
          } else if ('function' !== i)
            throw TypeError(
              (0 === e ? 'field' : 10 === e ? 'class' : 'method') +
                ' decorators must return a function or void 0',
            )
        }
        function r(e, t) {
          t &&
            e.push(function (e) {
              for (var n = 0; n < t.length; n++) t[n].call(e)
              return e
            })
        }
        function o(e, t) {
          return Object.defineProperty(e, Symbol.metadata || Symbol.for('Symbol.metadata'), {
            configurable: !0,
            enumerable: !0,
            value: t,
          })
        }
        return function (n, s, a, l) {
          if (void 0 !== l) var u = l[Symbol.metadata || Symbol.for('Symbol.metadata')]
          var c = Object.create(void 0 === u ? null : u),
            d = (function (e, n, o) {
              for (var s = [], a = new Map(), l = new Map(), u = 0; u < n.length; u++) {
                var c,
                  d,
                  f,
                  p,
                  h = n[u]
                if (Array.isArray(h)) {
                  var v = h[1],
                    y = h[2],
                    g = h.length > 3,
                    m = v >= 5
                  if (
                    (m
                      ? ((f = e), (v -= 5), (p = d = d || []))
                      : ((f = e.prototype), (p = c = c || [])),
                    0 !== v && !g)
                  ) {
                    var b = m ? l : a,
                      w = b.get(y) || 0
                    if (!0 === w || (3 === w && 4 !== v) || (4 === w && 3 !== v))
                      throw Error(
                        'Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: ' +
                          y,
                      )
                    !w && v > 2 ? b.set(y, v) : b.set(y, !0)
                  }
                  !(function (e, n, r, o, s, a, l, u, c) {
                    var d,
                      f,
                      p,
                      h,
                      v,
                      y,
                      g = r[0]
                    if (
                      (l
                        ? (d =
                            0 === s || 1 === s
                              ? { get: r[3], set: r[4] }
                              : 3 === s
                                ? { get: r[3] }
                                : 4 === s
                                  ? { set: r[3] }
                                  : { value: r[3] })
                        : 0 !== s && (d = Object.getOwnPropertyDescriptor(n, o)),
                      1 === s
                        ? (p = { get: d.get, set: d.set })
                        : 2 === s
                          ? (p = d.value)
                          : 3 === s
                            ? (p = d.get)
                            : 4 === s && (p = d.set),
                      'function' == typeof g)
                    )
                      void 0 !== (h = t(g, o, d, u, s, a, l, c, p)) &&
                        (i(s, h),
                        0 === s
                          ? (f = h)
                          : 1 === s
                            ? ((f = h.init),
                              (p = { get: (v = h.get || p.get), set: h.set || p.set }))
                            : (p = h))
                    else
                      for (var m = g.length - 1; m >= 0; m--)
                        void 0 !== (h = t(g[m], o, d, u, s, a, l, c, p)) &&
                          (i(s, h),
                          0 === s
                            ? (y = h)
                            : 1 === s
                              ? ((y = h.init),
                                (p = { get: (v = h.get || p.get), set: h.set || p.set }))
                              : (p = h),
                          void 0 !== y &&
                            (void 0 === f
                              ? (f = y)
                              : 'function' == typeof f
                                ? (f = [f, y])
                                : f.push(y)))
                    if (0 === s || 1 === s) {
                      if (void 0 === f)
                        f = function (e, t) {
                          return t
                        }
                      else if ('function' != typeof f) {
                        var b = f
                        f = function (e, t) {
                          for (var n = t, i = 0; i < b.length; i++) n = b[i].call(e, n)
                          return n
                        }
                      } else {
                        var w = f
                        f = function (e, t) {
                          return w.call(e, t)
                        }
                      }
                      e.push(f)
                    }
                    0 !== s &&
                      (1 === s
                        ? ((d.get = p.get), (d.set = p.set))
                        : 2 === s
                          ? (d.value = p)
                          : 3 === s
                            ? (d.get = p)
                            : 4 === s && (d.set = p),
                      l
                        ? 1 === s
                          ? (e.push(function (e, t) {
                              return p.get.call(e, t)
                            }),
                            e.push(function (e, t) {
                              return p.set.call(e, t)
                            }))
                          : 2 === s
                            ? e.push(p)
                            : e.push(function (e, t) {
                                return p.call(e, t)
                              })
                        : Object.defineProperty(n, o, d))
                  })(s, f, h, y, v, m, g, p, o)
                }
              }
              return (r(s, c), r(s, d), s)
            })(n, s, c)
          return (
            a.length || o(n, c),
            {
              e: d,
              get c() {
                return (function (t, n, r) {
                  if (n.length > 0) {
                    for (var s = [], a = t, l = t.name, u = n.length - 1; u >= 0; u--) {
                      var c = { v: !1 }
                      try {
                        var d = n[u](a, {
                          kind: 'class',
                          name: l,
                          addInitializer: e(s, c),
                          metadata: r,
                        })
                      } finally {
                        c.v = !0
                      }
                      void 0 !== d && (i(10, d), (a = d))
                    }
                    return [
                      o(a, r),
                      function () {
                        for (var e = 0; e < s.length; e++) s[e].call(a)
                      },
                    ]
                  }
                })(n, a, c)
              },
            }
          )
        }
      })())(e, t, n, i)
    }
    let rg = ib('Personalization')
    ;((p = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (h = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (v = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (y = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })),
      (g = iO('hasConsent', { onBlocked: 'onBlockedByConsent' })))
    class rm extends rv {
      static {
        ;({
          e: [m],
        } = ry(
          this,
          [
            [p, 2, 'identify'],
            [h, 2, 'page'],
            [v, 2, 'screen'],
            [y, 2, 'track'],
            [g, 2, 'trackView'],
          ],
          [],
        ))
      }
      offlineQueue = (m(this), new Set())
      flagObservables = new Map()
      queuePolicy
      flushRuntime
      states = {
        blockedEventStream: eg(ew),
        flag: (e) => this.getFlagObservable(e),
        eventStream: eg(ez),
        profile: eg(eP),
        selectedPersonalizations: eg(e$),
        canPersonalize: eg(eE),
      }
      getAnonymousId
      constructor(e) {
        const { api: t, eventBuilder: n, config: i, interceptors: r } = e
        super({ api: t, eventBuilder: n, config: i, interceptors: r })
        const { defaults: o, getAnonymousId: s, queuePolicy: a } = i ?? {}
        if (
          ((this.queuePolicy = ((e) => ({
            maxEvents: iS(e?.maxEvents, 100),
            onDrop: e?.onDrop,
            flushPolicy: iE(e?.flushPolicy),
          }))(a)),
          (this.flushRuntime = new iP({
            policy: this.queuePolicy.flushPolicy,
            onRetry: () => {
              this.flush()
            },
            onCallbackError: (e, t) => {
              rg.warn(`Personalization flush policy callback "${e}" failed`, t)
            },
          })),
          o)
        ) {
          const { changes: e, selectedPersonalizations: t, profile: n } = o
          k(() => {
            ;((eb.value = e), (e$.value = t), (eP.value = n))
          })
        }
        if (o?.consent !== void 0) {
          const { consent: e } = o
          e_.value = e
        }
        ;((this.getAnonymousId = s ?? (() => void 0)),
          D(() => {
            rg.debug(
              `Profile ${eP.value && `with ID ${eP.value.id}`} has been ${eP.value ? 'set' : 'cleared'}`,
            )
          }),
          D(() => {
            rg.debug(`Variants have been ${e$.value?.length ? 'populated' : 'cleared'}`)
          }),
          D(() => {
            rg.info(
              `Personalization ${e_.value ? 'will' : 'will not'} take effect due to consent (${e_.value})`,
            )
          }),
          D(() => {
            ek.value && (this.flushRuntime.clearScheduledRetry(), this.flush({ force: !0 }))
          }))
      }
      getFlagObservable(e) {
        let t = this.flagObservables.get(e)
        if (t) return t
        let n = em(
          ej.computed(() => super.getFlag(e, eb.value)),
          ri,
        )
        return (this.flagObservables.set(e, n), n)
      }
      reset() {
        ;(this.flushRuntime.reset(),
          k(() => {
            ;((eb.value = void 0),
              (ew.value = void 0),
              (ez.value = void 0),
              (eP.value = void 0),
              (e$.value = void 0))
          }))
      }
      getFlag(e, t = eb.value) {
        return super.getFlag(e, t)
      }
      personalizeEntry(e, t = e$.value) {
        return super.personalizeEntry(e, t)
      }
      getMergeTagValue(e, t = eP.value) {
        return super.getMergeTagValue(e, t)
      }
      hasConsent(e) {
        return (
          !!e_.value ||
          (this.allowedEventTypes ?? []).includes(
            'trackView' === e || 'trackFlagView' === e ? 'component' : e,
          )
        )
      }
      onBlockedByConsent(e, t) {
        ;(rg.warn(`Event "${e}" was blocked due to lack of consent; payload: ${JSON.stringify(t)}`),
          this.reportBlockedEvent('consent', 'personalization', e, t))
      }
      async identify(e) {
        rg.info('Sending "identify" event')
        let t = this.eventBuilder.buildIdentify(e)
        return await this.sendOrEnqueueEvent(t)
      }
      async page(e) {
        rg.info('Sending "page" event')
        let t = this.eventBuilder.buildPageView(e)
        return await this.sendOrEnqueueEvent(t)
      }
      async screen(e) {
        rg.info(`Sending "screen" event for "${e.name}"`)
        let t = this.eventBuilder.buildScreenView(e)
        return await this.sendOrEnqueueEvent(t)
      }
      async track(e) {
        rg.info(`Sending "track" event "${e.event}"`)
        let t = this.eventBuilder.buildTrack(e)
        return await this.sendOrEnqueueEvent(t)
      }
      async trackView(e) {
        rg.info(`Sending "track personalization" event for ${e.componentId}`)
        let t = this.eventBuilder.buildView(e)
        return await this.sendOrEnqueueEvent(t)
      }
      async sendOrEnqueueEvent(e) {
        let t = ig(n8, await this.interceptors.event.run(e))
        if (((ez.value = t), ek.value)) return await this.upsertProfile([t])
        ;(rg.debug(`Queueing ${t.type} event`, t), this.enqueueOfflineEvent(t))
      }
      enqueueOfflineEvent(e) {
        let t = []
        if (this.offlineQueue.size >= this.queuePolicy.maxEvents) {
          let e = this.offlineQueue.size - this.queuePolicy.maxEvents + 1
          ;(t = this.dropOldestOfflineEvents(e)).length > 0 &&
            rg.warn(
              `Dropped ${t.length} oldest personalization offline event(s) due to queue limit (${this.queuePolicy.maxEvents})`,
            )
        }
        ;(this.offlineQueue.add(e),
          t.length > 0 &&
            this.invokeQueueDropCallback({
              droppedCount: t.length,
              droppedEvents: t,
              maxEvents: this.queuePolicy.maxEvents,
              queuedEvents: this.offlineQueue.size,
            }))
      }
      dropOldestOfflineEvents(e) {
        let t = []
        for (let n = 0; n < e; n += 1) {
          let e = this.offlineQueue.values().next()
          if (e.done) break
          ;(this.offlineQueue.delete(e.value), t.push(e.value))
        }
        return t
      }
      invokeQueueDropCallback(e) {
        try {
          this.queuePolicy.onDrop?.(e)
        } catch (e) {
          rg.warn('Personalization offline queue drop callback failed', e)
        }
      }
      async flush(e = {}) {
        await this.flushOfflineQueue(e)
      }
      async flushOfflineQueue(e = {}) {
        let { force: t = !1 } = e
        if (this.flushRuntime.shouldSkip({ force: t, isOnline: !!ek.value })) return
        if (0 === this.offlineQueue.size) return void this.flushRuntime.clearScheduledRetry()
        rg.debug('Flushing offline event queue')
        let n = Array.from(this.offlineQueue)
        this.flushRuntime.markFlushStarted()
        try {
          ;(await this.tryUpsertQueuedEvents(n))
            ? (n.forEach((e) => {
                this.offlineQueue.delete(e)
              }),
              this.flushRuntime.handleFlushSuccess())
            : this.flushRuntime.handleFlushFailure({
                queuedBatches: +(this.offlineQueue.size > 0),
                queuedEvents: this.offlineQueue.size,
              })
        } finally {
          this.flushRuntime.markFlushFinished()
        }
      }
      async tryUpsertQueuedEvents(e) {
        try {
          return (await this.upsertProfile(e), !0)
        } catch (e) {
          return (rg.warn('Personalization offline queue flush request threw an error', e), !1)
        }
      }
      async upsertProfile(e) {
        let t = this.getAnonymousId()
        t && rg.debug(`Anonymous ID found: ${t}`)
        let n = await this.api.experience.upsertProfile({ profileId: t ?? eP.value?.id, events: e })
        return (await this.updateOutputSignals(n), n)
      }
      async updateOutputSignals(e) {
        let {
          changes: t,
          selectedPersonalizations: n,
          profile: i,
        } = await this.interceptors.state.run(e)
        k(() => {
          ;(ri(eb.value, t) || (eb.value = t),
            ri(eP.value, i) || (eP.value = i),
            ri(e$.value, n) || (e$.value = n))
        })
      }
    }
    ib('Personalization')
    let rb = Symbol.for('ctfl.optimization.preview.signals'),
      rw = Symbol.for('ctfl.optimization.preview.signalFns'),
      r_ = (e) => {
        if (void 0 === e) return { apiConfig: void 0, queuePolicy: void 0 }
        let { queuePolicy: t, ...n } = e
        return { apiConfig: Object.keys(n).length > 0 ? n : void 0, queuePolicy: t }
      },
      rz = 0
    class rk extends rt {
      singletonOwner
      destroyed = !1
      flagObservables = new Map()
      _analytics
      _personalization
      states = {
        blockedEventStream: eg(ew),
        flag: (e) => this.getFlagObservable(e),
        consent: eg(e_),
        eventStream: eg(ez),
        canPersonalize: eg(eE),
        selectedPersonalizations: eg(e$),
        previewPanelAttached: eg(eO),
        previewPanelOpen: eg(eS),
        profile: eg(eP),
      }
      constructor(e) {
        const { apiConfig: t, queuePolicy: n } = r_(e.analytics),
          { apiConfig: i, queuePolicy: r } = r_(e.personalization)
        ;(super({ ...e, analytics: t, personalization: i }),
          (this.singletonOwner = `CoreStateful#${++rz}`),
          ((e) => {
            let t = ro()
            if (t.owner)
              throw Error(
                `Stateful Optimization SDK already initialized (${t.owner}). Only one stateful instance is supported per runtime.`,
              )
            t.owner = e
          })(this.singletonOwner))
        try {
          const { allowedEventTypes: t, defaults: i, getAnonymousId: o, onEventBlocked: s } = e
          if (i?.consent !== void 0) {
            const { consent: e } = i
            e_.value = e
          }
          ;((this._analytics = new iC({
            api: this.api,
            eventBuilder: this.eventBuilder,
            config: {
              allowedEventTypes: t,
              queuePolicy: n,
              onEventBlocked: s,
              defaults: { consent: i?.consent, profile: i?.profile },
            },
            interceptors: this.interceptors,
          })),
            (this._personalization = new rm({
              api: this.api,
              eventBuilder: this.eventBuilder,
              config: {
                allowedEventTypes: t,
                getAnonymousId: o,
                queuePolicy: r,
                onEventBlocked: s,
                defaults: {
                  consent: i?.consent,
                  changes: i?.changes,
                  profile: i?.profile,
                  selectedPersonalizations: i?.personalizations,
                },
              },
              interceptors: this.interceptors,
            })))
        } catch (e) {
          throw (rs(this.singletonOwner), e)
        }
      }
      getFlag(e, t = eb.value) {
        let n = super.getFlag(e, t),
          i = this.buildFlagViewBuilderArgs(e, t)
        return (
          this.trackFlagView(i).catch((t) => {
            im.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
          }),
          n
        )
      }
      buildFlagViewBuilderArgs(e, t = eb.value) {
        let n = t?.find((t) => t.key === e)
        return {
          componentId: e,
          experienceId: n?.meta.experienceId,
          variantIndex: n?.meta.variantIndex,
        }
      }
      getFlagObservable(e) {
        let t = this.flagObservables.get(e)
        if (t) return t
        let n = this.trackFlagView.bind(this),
          i = this.buildFlagViewBuilderArgs.bind(this),
          { _personalization: r } = this,
          o = em(
            ej.computed(() => r.getFlag(e, eb.value)),
            ri,
          ),
          s = {
            get current() {
              let { current: t } = o
              return (
                n(i(e, eb.value)).catch((t) => {
                  im.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                t
              )
            },
            subscribe: (t) =>
              o.subscribe((r) => {
                ;(n(i(e, eb.value)).catch((t) => {
                  im.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                  t(r))
              }),
            subscribeOnce: (t) =>
              o.subscribeOnce((r) => {
                ;(n(i(e, eb.value)).catch((t) => {
                  im.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                  t(r))
              }),
          }
        return (this.flagObservables.set(e, s), s)
      }
      destroy() {
        this.destroyed || ((this.destroyed = !0), rs(this.singletonOwner))
      }
      reset() {
        k(() => {
          ;((ew.value = void 0),
            (ez.value = void 0),
            (eb.value = void 0),
            (eP.value = void 0),
            (e$.value = void 0))
        })
      }
      async flush() {
        ;(await this._analytics.flush(), await this._personalization.flush())
      }
      consent(e) {
        e_.value = e
      }
      get online() {
        return ek.value ?? !1
      }
      set online(e) {
        ek.value = e
      }
      registerPreviewPanel(e) {
        ;(Reflect.set(e, rb, ex), Reflect.set(e, rw, ej))
      }
    }
    let rO = null,
      rS = null,
      r$ = {
        initialize(e) {
          ;(rO && r$.destroy(),
            (rO = new rk({
              clientId: e.clientId,
              environment: e.environment,
              personalization: e.experienceBaseUrl ? { baseUrl: e.experienceBaseUrl } : void 0,
              analytics: e.insightsBaseUrl ? { baseUrl: e.insightsBaseUrl } : void 0,
            })).consent(!0),
            (rS = D(() => {
              let e = {
                  profile: ex.profile.value ?? null,
                  consent: ex.consent.value,
                  canPersonalize: ex.canPersonalize.value,
                  changes: ex.changes.value ?? null,
                },
                t = globalThis
              'function' == typeof t.__nativeOnStateChange &&
                t.__nativeOnStateChange(JSON.stringify(e))
            })))
        },
        identify(e, t, n) {
          rO
            ? rO
                .identify(e)
                .then((e) => {
                  t(JSON.stringify(e ?? null))
                })
                .catch((e) => {
                  n(e instanceof Error ? e.message : String(e))
                })
            : n('SDK not initialized. Call initialize() first.')
        },
        page(e, t, n) {
          rO
            ? rO
                .page(e)
                .then((e) => {
                  t(JSON.stringify(e ?? null))
                })
                .catch((e) => {
                  n(e instanceof Error ? e.message : String(e))
                })
            : n('SDK not initialized. Call initialize() first.')
        },
        getProfile() {
          let e = ex.profile.value
          return e ? JSON.stringify(e) : null
        },
        getState: () =>
          JSON.stringify({
            profile: ex.profile.value ?? null,
            consent: ex.consent.value,
            canPersonalize: ex.canPersonalize.value,
            changes: ex.changes.value ?? null,
          }),
        destroy() {
          ;(rS && (rS(), (rS = null)), rO && (rO.destroy(), (rO = null)))
        },
      }
    globalThis.__bridge = r$
    let rE = r$
    return w.default
  })(),
)
//# sourceMappingURL=optimization-ios-bridge.umd.js.map

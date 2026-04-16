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
    let e, t, i, n, r, s, o, a, l, u, c
    var d,
      p,
      f,
      h,
      v = {}
    ;((v.d = (e, t) => {
      for (var i in t)
        v.o(t, i) && !v.o(e, i) && Object.defineProperty(e, i, { enumerable: !0, get: t[i] })
    }),
      (v.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)))
    var y = {}
    v.d(y, { default: () => ss })
    var g = Symbol.for('preact-signals')
    function m() {
      if (S > 1) S--
      else {
        for (var e, t = !1; void 0 !== O; ) {
          var i = O
          for (O = void 0, E++; void 0 !== i; ) {
            var n = i.o
            if (((i.o = void 0), (i.f &= -3), !(8 & i.f) && j(i)))
              try {
                i.c()
              } catch (i) {
                t || ((e = i), (t = !0))
              }
            i = n
          }
        }
        if (((E = 0), S--, t)) throw e
      }
    }
    function b(e) {
      if (S > 0) return e()
      S++
      try {
        return e()
      } finally {
        m()
      }
    }
    var w = void 0
    function _(e) {
      var t = w
      w = void 0
      try {
        return e()
      } finally {
        w = t
      }
    }
    var z,
      O = void 0,
      S = 0,
      E = 0,
      k = 0
    function x(e) {
      if (void 0 !== w) {
        var t = e.n
        if (void 0 === t || t.t !== w)
          return (
            (t = { i: 0, S: e, p: w.s, n: void 0, t: w, e: void 0, x: void 0, r: t }),
            void 0 !== w.s && (w.s.n = t),
            (w.s = t),
            (e.n = t),
            32 & w.f && e.S(t),
            t
          )
        if (-1 === t.i)
          return (
            (t.i = 0),
            void 0 !== t.n &&
              ((t.n.p = t.p),
              void 0 !== t.p && (t.p.n = t.n),
              (t.p = w.s),
              (t.n = void 0),
              (w.s.n = t),
              (w.s = t)),
            t
          )
      }
    }
    function P(e, t) {
      ;((this.v = e),
        (this.i = 0),
        (this.n = void 0),
        (this.t = void 0),
        (this.W = null == t ? void 0 : t.watched),
        (this.Z = null == t ? void 0 : t.unwatched),
        (this.name = null == t ? void 0 : t.name))
    }
    function $(e, t) {
      return new P(e, t)
    }
    function j(e) {
      for (var t = e.s; void 0 !== t; t = t.n)
        if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0
      return !1
    }
    function I(e) {
      for (var t = e.s; void 0 !== t; t = t.n) {
        var i = t.S.n
        if ((void 0 !== i && (t.r = i), (t.S.n = t), (t.i = -1), void 0 === t.n)) {
          e.s = t
          break
        }
      }
    }
    function T(e) {
      for (var t = e.s, i = void 0; void 0 !== t; ) {
        var n = t.p
        ;(-1 === t.i
          ? (t.S.U(t), void 0 !== n && (n.n = t.n), void 0 !== t.n && (t.n.p = n))
          : (i = t),
          (t.S.n = t.r),
          void 0 !== t.r && (t.r = void 0),
          (t = n))
      }
      e.s = i
    }
    function A(e, t) {
      ;(P.call(this, void 0),
        (this.x = e),
        (this.s = void 0),
        (this.g = k - 1),
        (this.f = 4),
        (this.W = null == t ? void 0 : t.watched),
        (this.Z = null == t ? void 0 : t.unwatched),
        (this.name = null == t ? void 0 : t.name))
    }
    function F(e, t) {
      return new A(e, t)
    }
    function R(e) {
      var t = e.u
      if (((e.u = void 0), 'function' == typeof t)) {
        S++
        var i = w
        w = void 0
        try {
          t()
        } catch (t) {
          throw ((e.f &= -2), (e.f |= 8), C(e), t)
        } finally {
          ;((w = i), m())
        }
      }
    }
    function C(e) {
      for (var t = e.s; void 0 !== t; t = t.n) t.S.U(t)
      ;((e.x = void 0), (e.s = void 0), R(e))
    }
    function M(e) {
      if (w !== this) throw Error('Out-of-order effect')
      ;(T(this), (w = e), (this.f &= -2), 8 & this.f && C(this), m())
    }
    function B(e, t) {
      ;((this.x = e),
        (this.u = void 0),
        (this.s = void 0),
        (this.o = void 0),
        (this.f = 32),
        (this.name = null == t ? void 0 : t.name),
        z && z.push(this))
    }
    function q(e, t) {
      var i = new B(e, t)
      try {
        i.c()
      } catch (e) {
        throw (i.d(), e)
      }
      var n = i.d.bind(i)
      return ((n[Symbol.dispose] = n), n)
    }
    function U(e) {
      return Object.getOwnPropertySymbols(e).filter((t) =>
        Object.prototype.propertyIsEnumerable.call(e, t),
      )
    }
    function Z(e) {
      return null == e
        ? void 0 === e
          ? '[object Undefined]'
          : '[object Null]'
        : Object.prototype.toString.call(e)
    }
    ;((P.prototype.brand = g),
      (P.prototype.h = function () {
        return !0
      }),
      (P.prototype.S = function (e) {
        var t = this,
          i = this.t
        i !== e &&
          void 0 === e.e &&
          ((e.x = i),
          (this.t = e),
          void 0 !== i
            ? (i.e = e)
            : _(function () {
                var e
                null == (e = t.W) || e.call(t)
              }))
      }),
      (P.prototype.U = function (e) {
        var t = this
        if (void 0 !== this.t) {
          var i = e.e,
            n = e.x
          ;(void 0 !== i && ((i.x = n), (e.e = void 0)),
            void 0 !== n && ((n.e = i), (e.x = void 0)),
            e === this.t &&
              ((this.t = n),
              void 0 === n &&
                _(function () {
                  var e
                  null == (e = t.Z) || e.call(t)
                })))
        }
      }),
      (P.prototype.subscribe = function (e) {
        var t = this
        return q(
          function () {
            var i = t.value,
              n = w
            w = void 0
            try {
              e(i)
            } finally {
              w = n
            }
          },
          { name: 'sub' },
        )
      }),
      (P.prototype.valueOf = function () {
        return this.value
      }),
      (P.prototype.toString = function () {
        return this.value + ''
      }),
      (P.prototype.toJSON = function () {
        return this.value
      }),
      (P.prototype.peek = function () {
        var e = w
        w = void 0
        try {
          return this.value
        } finally {
          w = e
        }
      }),
      Object.defineProperty(P.prototype, 'value', {
        get: function () {
          var e = x(this)
          return (void 0 !== e && (e.i = this.i), this.v)
        },
        set: function (e) {
          if (e !== this.v) {
            if (E > 100) throw Error('Cycle detected')
            ;((this.v = e), this.i++, k++, S++)
            try {
              for (var t = this.t; void 0 !== t; t = t.x) t.t.N()
            } finally {
              m()
            }
          }
        },
      }),
      (A.prototype = new P()),
      (A.prototype.h = function () {
        if (((this.f &= -3), 1 & this.f)) return !1
        if (32 == (36 & this.f) || ((this.f &= -5), this.g === k)) return !0
        if (((this.g = k), (this.f |= 1), this.i > 0 && !j(this))) return ((this.f &= -2), !0)
        var e = w
        try {
          ;(I(this), (w = this))
          var t = this.x()
          ;(16 & this.f || this.v !== t || 0 === this.i) &&
            ((this.v = t), (this.f &= -17), this.i++)
        } catch (e) {
          ;((this.v = e), (this.f |= 16), this.i++)
        }
        return ((w = e), T(this), (this.f &= -2), !0)
      }),
      (A.prototype.S = function (e) {
        if (void 0 === this.t) {
          this.f |= 36
          for (var t = this.s; void 0 !== t; t = t.n) t.S.S(t)
        }
        P.prototype.S.call(this, e)
      }),
      (A.prototype.U = function (e) {
        if (void 0 !== this.t && (P.prototype.U.call(this, e), void 0 === this.t)) {
          this.f &= -33
          for (var t = this.s; void 0 !== t; t = t.n) t.S.U(t)
        }
      }),
      (A.prototype.N = function () {
        if (!(2 & this.f)) {
          this.f |= 6
          for (var e = this.t; void 0 !== e; e = e.x) e.t.N()
        }
      }),
      Object.defineProperty(A.prototype, 'value', {
        get: function () {
          if (1 & this.f) throw Error('Cycle detected')
          var e = x(this)
          if ((this.h(), void 0 !== e && (e.i = this.i), 16 & this.f)) throw this.v
          return this.v
        },
      }),
      (B.prototype.c = function () {
        var e = this.S()
        try {
          if (8 & this.f || void 0 === this.x) return
          var t = this.x()
          'function' == typeof t && (this.u = t)
        } finally {
          e()
        }
      }),
      (B.prototype.S = function () {
        if (1 & this.f) throw Error('Cycle detected')
        ;((this.f |= 1), (this.f &= -9), R(this), I(this), S++)
        var e = w
        return ((w = this), M.bind(this, e))
      }),
      (B.prototype.N = function () {
        2 & this.f || ((this.f |= 2), (this.o = O), (O = this))
      }),
      (B.prototype.d = function () {
        ;((this.f |= 8), 1 & this.f || C(this))
      }),
      (B.prototype.dispose = function () {
        this.d()
      }))
    let N = '[object RegExp]',
      V = '[object String]',
      D = '[object Number]',
      L = '[object Boolean]',
      Q = '[object Arguments]',
      J = '[object Symbol]',
      H = '[object Date]',
      K = '[object Map]',
      W = '[object Set]',
      G = '[object Array]',
      X = '[object ArrayBuffer]',
      Y = '[object Object]',
      ee = '[object DataView]',
      et = '[object Uint8Array]',
      ei = '[object Uint8ClampedArray]',
      en = '[object Uint16Array]',
      er = '[object Uint32Array]',
      es = '[object Int8Array]',
      eo = '[object Int16Array]',
      ea = '[object Int32Array]',
      el = '[object Float32Array]',
      eu = '[object Float64Array]'
    function ec(e, t, i, n = new Map(), r) {
      let s = r?.(e, t, i, n)
      if (void 0 !== s) return s
      if (null == e || ('object' != typeof e && 'function' != typeof e)) return e
      if (n.has(e)) return n.get(e)
      if (Array.isArray(e)) {
        let t = Array(e.length)
        n.set(e, t)
        for (let s = 0; s < e.length; s++) t[s] = ec(e[s], s, i, n, r)
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
        for (let [s, o] of (n.set(e, t), e)) t.set(s, ec(o, s, i, n, r))
        return t
      }
      if (e instanceof Set) {
        let t = new Set()
        for (let s of (n.set(e, t), e)) t.add(ec(s, void 0, i, n, r))
        return t
      }
      if ('u' > typeof Buffer && Buffer.isBuffer(e)) return e.subarray()
      if (ArrayBuffer.isView(e) && !(e instanceof DataView)) {
        let t = new (Object.getPrototypeOf(e).constructor)(e.length)
        n.set(e, t)
        for (let s = 0; s < e.length; s++) t[s] = ec(e[s], s, i, n, r)
        return t
      }
      if (
        e instanceof ArrayBuffer ||
        ('u' > typeof SharedArrayBuffer && e instanceof SharedArrayBuffer)
      )
        return e.slice(0)
      if (e instanceof DataView) {
        let t = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength)
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      if ('u' > typeof File && e instanceof File) {
        let t = new File([e], e.name, { type: e.type })
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      if ('u' > typeof Blob && e instanceof Blob) {
        let t = new Blob([e], { type: e.type })
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      if (e instanceof Error) {
        let t = structuredClone(e)
        return (
          n.set(e, t),
          (t.message = e.message),
          (t.name = e.name),
          (t.stack = e.stack),
          (t.cause = e.cause),
          (t.constructor = e.constructor),
          ed(t, e, i, n, r),
          t
        )
      }
      if (e instanceof Boolean) {
        let t = new Boolean(e.valueOf())
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      if (e instanceof Number) {
        let t = new Number(e.valueOf())
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      if (e instanceof String) {
        let t = new String(e.valueOf())
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      if (
        'object' == typeof e &&
        (function (e) {
          switch (Z(e)) {
            case Q:
            case G:
            case X:
            case ee:
            case L:
            case H:
            case el:
            case eu:
            case es:
            case eo:
            case ea:
            case K:
            case D:
            case Y:
            case N:
            case W:
            case V:
            case J:
            case et:
            case ei:
            case en:
            case er:
              return !0
            default:
              return !1
          }
        })(e)
      ) {
        let t = Object.create(Object.getPrototypeOf(e))
        return (n.set(e, t), ed(t, e, i, n, r), t)
      }
      return e
    }
    function ed(e, t, i = e, n, r) {
      let s = [...Object.keys(t), ...U(t)]
      for (let o = 0; o < s.length; o++) {
        let a = s[o],
          l = Object.getOwnPropertyDescriptor(e, a)
        ;(null == l || l.writable) && (e[a] = ec(t[a], a, i, n, r))
      }
    }
    function ep(e) {
      return ec(e, void 0, e, new Map(), void 0)
    }
    function ef(e) {
      return {
        get current() {
          return ep(e.value)
        },
        subscribe: (t) => ({
          unsubscribe: q(() => {
            t(ep(e.value))
          }),
        }),
        subscribeOnce(t) {
          let i = !1,
            n = !1,
            r = () => void 0
          return (
            (r = q(() => {
              if (i) return
              let { value: s } = e
              if (null == s) return
              i = !0
              let o = null
              try {
                t(ep(s))
              } catch (e) {
                o = e instanceof Error ? e : Error(`Subscriber threw non-Error value: ${String(e)}`)
              }
              if ((n ? r() : queueMicrotask(r), o)) throw o
            })),
            (n = !0),
            {
              unsubscribe: () => {
                !i && ((i = !0), n && r())
              },
            }
          )
        },
      }
    }
    let eh = $(),
      ev = $(),
      ey = $(),
      eg = $(),
      em = $(!0),
      eb = $(!1),
      ew = $(!1),
      e_ = $(),
      ez = F(() => void 0 !== e_.value),
      eO = $(),
      eS = {
        blockedEvent: ev,
        changes: eh,
        consent: ey,
        event: eg,
        online: em,
        previewPanelAttached: eb,
        previewPanelOpen: ew,
        selectedOptimizations: e_,
        canOptimize: ez,
        profile: eO,
      },
      eE = { batch: b, computed: F, effect: q, untracked: _ }
    function ek(e, t, i) {
      function n(i, n) {
        if (
          (i._zod ||
            Object.defineProperty(i, '_zod', {
              value: { def: n, constr: o, traits: new Set() },
              enumerable: !1,
            }),
          i._zod.traits.has(e))
        )
          return
        ;(i._zod.traits.add(e), t(i, n))
        let r = o.prototype,
          s = Object.keys(r)
        for (let e = 0; e < s.length; e++) {
          let t = s[e]
          t in i || (i[t] = r[t].bind(i))
        }
      }
      let r = i?.Parent ?? Object
      class s extends r {}
      function o(e) {
        var t
        let r = i?.Parent ? new s() : this
        for (let i of (n(r, e), (t = r._zod).deferred ?? (t.deferred = []), r._zod.deferred)) i()
        return r
      }
      return (
        Object.defineProperty(s, 'name', { value: e }),
        Object.defineProperty(o, 'init', { value: n }),
        Object.defineProperty(o, Symbol.hasInstance, {
          value: (t) => (!!i?.Parent && t instanceof i.Parent) || t?._zod?.traits?.has(e),
        }),
        Object.defineProperty(o, 'name', { value: e }),
        o
      )
    }
    ;(Object.freeze({ status: 'aborted' }), Symbol('zod_brand'))
    class ex extends Error {
      constructor() {
        super('Encountered Promise during synchronous parse. Use .parseAsync() instead.')
      }
    }
    let eP = {}
    function e$(e) {
      return (e && Object.assign(eP, e), eP)
    }
    function ej(e, t = '|') {
      return e.map((e) => eV(e)).join(t)
    }
    function eI(e, t) {
      return 'bigint' == typeof t ? t.toString() : t
    }
    function eT(e) {
      return {
        get value() {
          {
            let t = e()
            return (Object.defineProperty(this, 'value', { value: t }), t)
          }
        },
      }
    }
    function eA(e) {
      let t = +!!e.startsWith('^'),
        i = e.endsWith('$') ? e.length - 1 : e.length
      return e.slice(t, i)
    }
    let eF = Symbol('evaluating')
    function eR(e, t, i) {
      let n
      Object.defineProperty(e, t, {
        get() {
          if (n !== eF) return (void 0 === n && ((n = eF), (n = i())), n)
        },
        set(i) {
          Object.defineProperty(e, t, { value: i })
        },
        configurable: !0,
      })
    }
    let eC = 'captureStackTrace' in Error ? Error.captureStackTrace : (...e) => {}
    function eM(e) {
      return 'object' == typeof e && null !== e && !Array.isArray(e)
    }
    function eB(e) {
      if (!1 === eM(e)) return !1
      let t = e.constructor
      if (void 0 === t || 'function' != typeof t) return !0
      let i = t.prototype
      return !1 !== eM(i) && !1 !== Object.prototype.hasOwnProperty.call(i, 'isPrototypeOf')
    }
    eT(() => {
      if ('u' > typeof navigator && navigator?.userAgent?.includes('Cloudflare')) return !1
      try {
        return (Function(''), !0)
      } catch (e) {
        return !1
      }
    })
    let eq = new Set(['string', 'number', 'symbol'])
    function eU(e) {
      return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    function eZ(e, t, i) {
      let n = new e._zod.constr(t ?? e._zod.def)
      return ((!t || i?.parent) && (n._zod.parent = e), n)
    }
    function eN(e) {
      if (!e) return {}
      if ('string' == typeof e) return { error: () => e }
      if (e?.message !== void 0) {
        if (e?.error !== void 0) throw Error('Cannot specify both `message` and `error` params')
        e.error = e.message
      }
      return (delete e.message, 'string' == typeof e.error) ? { ...e, error: () => e.error } : e
    }
    function eV(e) {
      return 'bigint' == typeof e ? e.toString() + 'n' : 'string' == typeof e ? `"${e}"` : `${e}`
    }
    function eD(e, t = 0) {
      if (!0 === e.aborted) return !0
      for (let i = t; i < e.issues.length; i++) if (e.issues[i]?.continue !== !0) return !0
      return !1
    }
    function eL(e, t) {
      return t.map((t) => (t.path ?? (t.path = []), t.path.unshift(e), t))
    }
    function eQ(e) {
      return 'string' == typeof e ? e : e?.message
    }
    function eJ(e, t, i) {
      let n = { ...e, path: e.path ?? [] }
      return (
        e.message ||
          (n.message =
            eQ(e.inst?._zod.def?.error?.(e)) ??
            eQ(t?.error?.(e)) ??
            eQ(i.customError?.(e)) ??
            eQ(i.localeError?.(e)) ??
            'Invalid input'),
        delete n.inst,
        delete n.continue,
        t?.reportInput || delete n.input,
        n
      )
    }
    function eH(e) {
      return Array.isArray(e) ? 'array' : 'string' == typeof e ? 'string' : 'unknown'
    }
    let eK = (e, t) => {
        ;((e.name = '$ZodError'),
          Object.defineProperty(e, '_zod', { value: e._zod, enumerable: !1 }),
          Object.defineProperty(e, 'issues', { value: t, enumerable: !1 }),
          (e.message = JSON.stringify(t, eI, 2)),
          Object.defineProperty(e, 'toString', { value: () => e.message, enumerable: !1 }))
      },
      eW = ek('$ZodError', eK),
      eG = ek('$ZodError', eK, { Parent: Error }),
      eX =
        ((e = eG),
        (t, i, n, r) => {
          let s = n ? Object.assign(n, { async: !1 }) : { async: !1 },
            o = t._zod.run({ value: i, issues: [] }, s)
          if (o instanceof Promise) throw new ex()
          if (o.issues.length) {
            let t = new (r?.Err ?? e)(o.issues.map((e) => eJ(e, s, e$())))
            throw (eC(t, r?.callee), t)
          }
          return o.value
        }),
      eY =
        ((t = eG),
        async (e, i, n, r) => {
          let s = n ? Object.assign(n, { async: !0 }) : { async: !0 },
            o = e._zod.run({ value: i, issues: [] }, s)
          if ((o instanceof Promise && (o = await o), o.issues.length)) {
            let e = new (r?.Err ?? t)(o.issues.map((e) => eJ(e, s, e$())))
            throw (eC(e, r?.callee), e)
          }
          return o.value
        }),
      e0 =
        ((i = eG),
        (e, t, n) => {
          let r = n ? { ...n, async: !1 } : { async: !1 },
            s = e._zod.run({ value: t, issues: [] }, r)
          if (s instanceof Promise) throw new ex()
          return s.issues.length
            ? { success: !1, error: new (i ?? eW)(s.issues.map((e) => eJ(e, r, e$()))) }
            : { success: !0, data: s.value }
        }),
      e1 =
        ((n = eG),
        async (e, t, i) => {
          let r = i ? Object.assign(i, { async: !0 }) : { async: !0 },
            s = e._zod.run({ value: t, issues: [] }, r)
          return (
            s instanceof Promise && (s = await s),
            s.issues.length
              ? { success: !1, error: new n(s.issues.map((e) => eJ(e, r, e$()))) }
              : { success: !0, data: s.value }
          )
        }),
      e2 =
        /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/,
      e6 =
        '(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))',
      e3 = RegExp(`^${e6}$`)
    function e4(e) {
      let t = '(?:[01]\\d|2[0-3]):[0-5]\\d'
      return 'number' == typeof e.precision
        ? -1 === e.precision
          ? `${t}`
          : 0 === e.precision
            ? `${t}:[0-5]\\d`
            : `${t}:[0-5]\\d\\.\\d{${e.precision}}`
        : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`
    }
    let e8 = /^-?\d+(?:\.\d+)?$/,
      e5 = /^(?:true|false)$/i,
      e9 = /^null$/i,
      e7 = ek('$ZodCheck', (e, t) => {
        var i
        ;(e._zod ?? (e._zod = {}), (e._zod.def = t), (i = e._zod).onattach ?? (i.onattach = []))
      }),
      te = ek('$ZodCheckMinLength', (e, t) => {
        var i
        ;(e7.init(e, t),
          (i = e._zod.def).when ??
            (i.when = (e) => {
              let t = e.value
              return null != t && void 0 !== t.length
            }),
          e._zod.onattach.push((e) => {
            let i = e._zod.bag.minimum ?? -1 / 0
            t.minimum > i && (e._zod.bag.minimum = t.minimum)
          }),
          (e._zod.check = (i) => {
            let n = i.value
            if (n.length >= t.minimum) return
            let r = eH(n)
            i.issues.push({
              origin: r,
              code: 'too_small',
              minimum: t.minimum,
              inclusive: !0,
              input: n,
              inst: e,
              continue: !t.abort,
            })
          }))
      }),
      tt = ek('$ZodCheckLengthEquals', (e, t) => {
        var i
        ;(e7.init(e, t),
          (i = e._zod.def).when ??
            (i.when = (e) => {
              let t = e.value
              return null != t && void 0 !== t.length
            }),
          e._zod.onattach.push((e) => {
            let i = e._zod.bag
            ;((i.minimum = t.length), (i.maximum = t.length), (i.length = t.length))
          }),
          (e._zod.check = (i) => {
            let n = i.value,
              r = n.length
            if (r === t.length) return
            let s = eH(n),
              o = r > t.length
            i.issues.push({
              origin: s,
              ...(o
                ? { code: 'too_big', maximum: t.length }
                : { code: 'too_small', minimum: t.length }),
              inclusive: !0,
              exact: !0,
              input: i.value,
              inst: e,
              continue: !t.abort,
            })
          }))
      }),
      ti = ek('$ZodCheckStringFormat', (e, t) => {
        var i, n
        ;(e7.init(e, t),
          e._zod.onattach.push((e) => {
            let i = e._zod.bag
            ;((i.format = t.format),
              t.pattern && (i.patterns ?? (i.patterns = new Set()), i.patterns.add(t.pattern)))
          }),
          t.pattern
            ? ((i = e._zod).check ??
              (i.check = (i) => {
                ;((t.pattern.lastIndex = 0),
                  t.pattern.test(i.value) ||
                    i.issues.push({
                      origin: 'string',
                      code: 'invalid_format',
                      format: t.format,
                      input: i.value,
                      ...(t.pattern ? { pattern: t.pattern.toString() } : {}),
                      inst: e,
                      continue: !t.abort,
                    }))
              }))
            : ((n = e._zod).check ?? (n.check = () => {})))
      }),
      tn = { major: 4, minor: 3, patch: 6 },
      tr = ek('$ZodType', (e, t) => {
        var i
        ;(e ?? (e = {}), (e._zod.def = t), (e._zod.bag = e._zod.bag || {}), (e._zod.version = tn))
        let n = [...(e._zod.def.checks ?? [])]
        for (let t of (e._zod.traits.has('$ZodCheck') && n.unshift(e), n))
          for (let i of t._zod.onattach) i(e)
        if (0 === n.length)
          ((i = e._zod).deferred ?? (i.deferred = []),
            e._zod.deferred?.push(() => {
              e._zod.run = e._zod.parse
            }))
        else {
          let t = (e, t, i) => {
              let n,
                r = eD(e)
              for (let s of t) {
                if (s._zod.def.when) {
                  if (!s._zod.def.when(e)) continue
                } else if (r) continue
                let t = e.issues.length,
                  o = s._zod.check(e)
                if (o instanceof Promise && i?.async === !1) throw new ex()
                if (n || o instanceof Promise)
                  n = (n ?? Promise.resolve()).then(async () => {
                    ;(await o, e.issues.length !== t && (r || (r = eD(e, t))))
                  })
                else {
                  if (e.issues.length === t) continue
                  r || (r = eD(e, t))
                }
              }
              return n ? n.then(() => e) : e
            },
            i = (i, r, s) => {
              if (eD(i)) return ((i.aborted = !0), i)
              let o = t(r, n, s)
              if (o instanceof Promise) {
                if (!1 === s.async) throw new ex()
                return o.then((t) => e._zod.parse(t, s))
              }
              return e._zod.parse(o, s)
            }
          e._zod.run = (r, s) => {
            if (s.skipChecks) return e._zod.parse(r, s)
            if ('backward' === s.direction) {
              let t = e._zod.parse({ value: r.value, issues: [] }, { ...s, skipChecks: !0 })
              return t instanceof Promise ? t.then((e) => i(e, r, s)) : i(t, r, s)
            }
            let o = e._zod.parse(r, s)
            if (o instanceof Promise) {
              if (!1 === s.async) throw new ex()
              return o.then((e) => t(e, n, s))
            }
            return t(o, n, s)
          }
        }
        eR(e, '~standard', () => ({
          validate: (t) => {
            try {
              let i = e0(e, t)
              return i.success ? { value: i.data } : { issues: i.error?.issues }
            } catch (i) {
              return e1(e, t).then((e) =>
                e.success ? { value: e.data } : { issues: e.error?.issues },
              )
            }
          },
          vendor: 'zod',
          version: 1,
        }))
      }),
      ts = ek('$ZodString', (e, t) => {
        var i
        let n
        ;(tr.init(e, t),
          (e._zod.pattern =
            [...(e?._zod.bag?.patterns ?? [])].pop() ??
            ((n = (i = e._zod.bag)
              ? `[\\s\\S]{${i?.minimum ?? 0},${i?.maximum ?? ''}}`
              : '[\\s\\S]*'),
            RegExp(`^${n}$`))),
          (e._zod.parse = (i, n) => {
            if (t.coerce)
              try {
                i.value = String(i.value)
              } catch (e) {}
            return (
              'string' == typeof i.value ||
                i.issues.push({
                  expected: 'string',
                  code: 'invalid_type',
                  input: i.value,
                  inst: e,
                }),
              i
            )
          }))
      }),
      to = ek('$ZodStringFormat', (e, t) => {
        ;(ti.init(e, t), ts.init(e, t))
      }),
      ta = ek('$ZodISODateTime', (e, t) => {
        let i, n, r
        ;(t.pattern ??
          ((i = e4({ precision: t.precision })),
          (n = ['Z']),
          t.local && n.push(''),
          t.offset && n.push('([+-](?:[01]\\d|2[0-3]):[0-5]\\d)'),
          (r = `${i}(?:${n.join('|')})`),
          (t.pattern = RegExp(`^${e6}T(?:${r})$`))),
          to.init(e, t))
      }),
      tl =
        ((e, t) => {
          ;(t.pattern ?? (t.pattern = e3), to.init(e, t))
        },
        ek('$ZodNumber', (e, t) => {
          ;(tr.init(e, t),
            (e._zod.pattern = e._zod.bag.pattern ?? e8),
            (e._zod.parse = (i, n) => {
              if (t.coerce)
                try {
                  i.value = Number(i.value)
                } catch (e) {}
              let r = i.value
              if ('number' == typeof r && !Number.isNaN(r) && Number.isFinite(r)) return i
              let s =
                'number' == typeof r
                  ? Number.isNaN(r)
                    ? 'NaN'
                    : Number.isFinite(r)
                      ? void 0
                      : 'Infinity'
                  : void 0
              return (
                i.issues.push({
                  expected: 'number',
                  code: 'invalid_type',
                  input: r,
                  inst: e,
                  ...(s ? { received: s } : {}),
                }),
                i
              )
            }))
        })),
      tu = ek('$ZodBoolean', (e, t) => {
        ;(tr.init(e, t),
          (e._zod.pattern = e5),
          (e._zod.parse = (i, n) => {
            if (t.coerce)
              try {
                i.value = !!i.value
              } catch (e) {}
            let r = i.value
            return (
              'boolean' == typeof r ||
                i.issues.push({ expected: 'boolean', code: 'invalid_type', input: r, inst: e }),
              i
            )
          }))
      }),
      tc = ek('$ZodNull', (e, t) => {
        ;(tr.init(e, t),
          (e._zod.pattern = e9),
          (e._zod.values = new Set([null])),
          (e._zod.parse = (t, i) => {
            let n = t.value
            return (
              null === n ||
                t.issues.push({ expected: 'null', code: 'invalid_type', input: n, inst: e }),
              t
            )
          }))
      }),
      td = ek('$ZodAny', (e, t) => {
        ;(tr.init(e, t), (e._zod.parse = (e) => e))
      }),
      tp = ek('$ZodUnknown', (e, t) => {
        ;(tr.init(e, t), (e._zod.parse = (e) => e))
      })
    function tf(e, t, i) {
      ;(e.issues.length && t.issues.push(...eL(i, e.issues)), (t.value[i] = e.value))
    }
    let th = ek('$ZodArray', (e, t) => {
      ;(tr.init(e, t),
        (e._zod.parse = (i, n) => {
          let r = i.value
          if (!Array.isArray(r))
            return (
              i.issues.push({ expected: 'array', code: 'invalid_type', input: r, inst: e }),
              i
            )
          i.value = Array(r.length)
          let s = []
          for (let e = 0; e < r.length; e++) {
            let o = r[e],
              a = t.element._zod.run({ value: o, issues: [] }, n)
            a instanceof Promise ? s.push(a.then((t) => tf(t, i, e))) : tf(a, i, e)
          }
          return s.length ? Promise.all(s).then(() => i) : i
        }))
    })
    function tv(e, t, i, n, r) {
      if (e.issues.length) {
        if (r && !(i in n)) return
        t.issues.push(...eL(i, e.issues))
      }
      void 0 === e.value ? i in n && (t.value[i] = void 0) : (t.value[i] = e.value)
    }
    let ty = ek('$ZodObject', (e, t) => {
      let i
      tr.init(e, t)
      let n = Object.getOwnPropertyDescriptor(t, 'shape')
      if (!n?.get) {
        let e = t.shape
        Object.defineProperty(t, 'shape', {
          get: () => {
            let i = { ...e }
            return (Object.defineProperty(t, 'shape', { value: i }), i)
          },
        })
      }
      let r = eT(() =>
        (function (e) {
          var t
          let i = Object.keys(e.shape)
          for (let t of i)
            if (!e.shape?.[t]?._zod?.traits?.has('$ZodType'))
              throw Error(`Invalid element at key "${t}": expected a Zod schema`)
          let n = Object.keys((t = e.shape)).filter(
            (e) => 'optional' === t[e]._zod.optin && 'optional' === t[e]._zod.optout,
          )
          return { ...e, keys: i, keySet: new Set(i), numKeys: i.length, optionalKeys: new Set(n) }
        })(t),
      )
      eR(e._zod, 'propValues', () => {
        let e = t.shape,
          i = {}
        for (let t in e) {
          let n = e[t]._zod
          if (n.values) for (let e of (i[t] ?? (i[t] = new Set()), n.values)) i[t].add(e)
        }
        return i
      })
      let s = t.catchall
      e._zod.parse = (t, n) => {
        i ?? (i = r.value)
        let o = t.value
        if (!eM(o))
          return (t.issues.push({ expected: 'object', code: 'invalid_type', input: o, inst: e }), t)
        t.value = {}
        let a = [],
          l = i.shape
        for (let e of i.keys) {
          let i = l[e],
            r = 'optional' === i._zod.optout,
            s = i._zod.run({ value: o[e], issues: [] }, n)
          s instanceof Promise ? a.push(s.then((i) => tv(i, t, e, o, r))) : tv(s, t, e, o, r)
        }
        return s
          ? (function (e, t, i, n, r, s) {
              let o = [],
                a = r.keySet,
                l = r.catchall._zod,
                u = l.def.type,
                c = 'optional' === l.optout
              for (let r in t) {
                if (a.has(r)) continue
                if ('never' === u) {
                  o.push(r)
                  continue
                }
                let s = l.run({ value: t[r], issues: [] }, n)
                s instanceof Promise ? e.push(s.then((e) => tv(e, i, r, t, c))) : tv(s, i, r, t, c)
              }
              return (o.length &&
                i.issues.push({ code: 'unrecognized_keys', keys: o, input: t, inst: s }),
              e.length)
                ? Promise.all(e).then(() => i)
                : i
            })(a, o, t, n, r.value, e)
          : a.length
            ? Promise.all(a).then(() => t)
            : t
      }
    })
    function tg(e, t, i, n) {
      for (let i of e) if (0 === i.issues.length) return ((t.value = i.value), t)
      let r = e.filter((e) => !eD(e))
      return 1 === r.length
        ? ((t.value = r[0].value), r[0])
        : (t.issues.push({
            code: 'invalid_union',
            input: t.value,
            inst: i,
            errors: e.map((e) => e.issues.map((e) => eJ(e, n, e$()))),
          }),
          t)
    }
    let tm = ek('$ZodUnion', (e, t) => {
        ;(tr.init(e, t),
          eR(e._zod, 'optin', () =>
            t.options.some((e) => 'optional' === e._zod.optin) ? 'optional' : void 0,
          ),
          eR(e._zod, 'optout', () =>
            t.options.some((e) => 'optional' === e._zod.optout) ? 'optional' : void 0,
          ),
          eR(e._zod, 'values', () => {
            if (t.options.every((e) => e._zod.values))
              return new Set(t.options.flatMap((e) => Array.from(e._zod.values)))
          }),
          eR(e._zod, 'pattern', () => {
            if (t.options.every((e) => e._zod.pattern)) {
              let e = t.options.map((e) => e._zod.pattern)
              return RegExp(`^(${e.map((e) => eA(e.source)).join('|')})$`)
            }
          }))
        let i = 1 === t.options.length,
          n = t.options[0]._zod.run
        e._zod.parse = (r, s) => {
          if (i) return n(r, s)
          let o = !1,
            a = []
          for (let e of t.options) {
            let t = e._zod.run({ value: r.value, issues: [] }, s)
            if (t instanceof Promise) (a.push(t), (o = !0))
            else {
              if (0 === t.issues.length) return t
              a.push(t)
            }
          }
          return o ? Promise.all(a).then((t) => tg(t, r, e, s)) : tg(a, r, e, s)
        }
      }),
      tb = ek('$ZodDiscriminatedUnion', (e, t) => {
        ;((t.inclusive = !1), tm.init(e, t))
        let i = e._zod.parse
        eR(e._zod, 'propValues', () => {
          let e = {}
          for (let i of t.options) {
            let n = i._zod.propValues
            if (!n || 0 === Object.keys(n).length)
              throw Error(`Invalid discriminated union option at index "${t.options.indexOf(i)}"`)
            for (let [t, i] of Object.entries(n))
              for (let n of (e[t] || (e[t] = new Set()), i)) e[t].add(n)
          }
          return e
        })
        let n = eT(() => {
          let e = t.options,
            i = new Map()
          for (let n of e) {
            let e = n._zod.propValues?.[t.discriminator]
            if (!e || 0 === e.size)
              throw Error(`Invalid discriminated union option at index "${t.options.indexOf(n)}"`)
            for (let t of e) {
              if (i.has(t)) throw Error(`Duplicate discriminator value "${String(t)}"`)
              i.set(t, n)
            }
          }
          return i
        })
        e._zod.parse = (r, s) => {
          let o = r.value
          if (!eM(o))
            return (
              r.issues.push({ code: 'invalid_type', expected: 'object', input: o, inst: e }),
              r
            )
          let a = n.value.get(o?.[t.discriminator])
          return a
            ? a._zod.run(r, s)
            : t.unionFallback
              ? i(r, s)
              : (r.issues.push({
                  code: 'invalid_union',
                  errors: [],
                  note: 'No matching discriminator',
                  discriminator: t.discriminator,
                  input: o,
                  path: [t.discriminator],
                  inst: e,
                }),
                r)
        }
      }),
      tw = ek('$ZodRecord', (e, t) => {
        ;(tr.init(e, t),
          (e._zod.parse = (i, n) => {
            let r = i.value
            if (!eB(r))
              return (
                i.issues.push({ expected: 'record', code: 'invalid_type', input: r, inst: e }),
                i
              )
            let s = [],
              o = t.keyType._zod.values
            if (o) {
              let a
              i.value = {}
              let l = new Set()
              for (let e of o)
                if ('string' == typeof e || 'number' == typeof e || 'symbol' == typeof e) {
                  l.add('number' == typeof e ? e.toString() : e)
                  let o = t.valueType._zod.run({ value: r[e], issues: [] }, n)
                  o instanceof Promise
                    ? s.push(
                        o.then((t) => {
                          ;(t.issues.length && i.issues.push(...eL(e, t.issues)),
                            (i.value[e] = t.value))
                        }),
                      )
                    : (o.issues.length && i.issues.push(...eL(e, o.issues)), (i.value[e] = o.value))
                }
              for (let e in r) l.has(e) || (a = a ?? []).push(e)
              a &&
                a.length > 0 &&
                i.issues.push({ code: 'unrecognized_keys', input: r, inst: e, keys: a })
            } else
              for (let o of ((i.value = {}), Reflect.ownKeys(r))) {
                if ('__proto__' === o) continue
                let a = t.keyType._zod.run({ value: o, issues: [] }, n)
                if (a instanceof Promise)
                  throw Error('Async schemas not supported in object keys currently')
                if ('string' == typeof o && e8.test(o) && a.issues.length) {
                  let e = t.keyType._zod.run({ value: Number(o), issues: [] }, n)
                  if (e instanceof Promise)
                    throw Error('Async schemas not supported in object keys currently')
                  0 === e.issues.length && (a = e)
                }
                if (a.issues.length) {
                  'loose' === t.mode
                    ? (i.value[o] = r[o])
                    : i.issues.push({
                        code: 'invalid_key',
                        origin: 'record',
                        issues: a.issues.map((e) => eJ(e, n, e$())),
                        input: o,
                        path: [o],
                        inst: e,
                      })
                  continue
                }
                let l = t.valueType._zod.run({ value: r[o], issues: [] }, n)
                l instanceof Promise
                  ? s.push(
                      l.then((e) => {
                        ;(e.issues.length && i.issues.push(...eL(o, e.issues)),
                          (i.value[a.value] = e.value))
                      }),
                    )
                  : (l.issues.length && i.issues.push(...eL(o, l.issues)),
                    (i.value[a.value] = l.value))
              }
            return s.length ? Promise.all(s).then(() => i) : i
          }))
      }),
      t_ = ek('$ZodEnum', (e, t) => {
        var i
        let n
        tr.init(e, t)
        let r =
            ((n = Object.values((i = t.entries)).filter((e) => 'number' == typeof e)),
            Object.entries(i)
              .filter(([e, t]) => -1 === n.indexOf(+e))
              .map(([e, t]) => t)),
          s = new Set(r)
        ;((e._zod.values = s),
          (e._zod.pattern = RegExp(
            `^(${r
              .filter((e) => eq.has(typeof e))
              .map((e) => ('string' == typeof e ? eU(e) : e.toString()))
              .join('|')})$`,
          )),
          (e._zod.parse = (t, i) => {
            let n = t.value
            return (
              s.has(n) || t.issues.push({ code: 'invalid_value', values: r, input: n, inst: e }),
              t
            )
          }))
      }),
      tz = ek('$ZodLiteral', (e, t) => {
        if ((tr.init(e, t), 0 === t.values.length))
          throw Error('Cannot create literal schema with no valid values')
        let i = new Set(t.values)
        ;((e._zod.values = i),
          (e._zod.pattern = RegExp(
            `^(${t.values.map((e) => ('string' == typeof e ? eU(e) : e ? eU(e.toString()) : String(e))).join('|')})$`,
          )),
          (e._zod.parse = (n, r) => {
            let s = n.value
            return (
              i.has(s) ||
                n.issues.push({ code: 'invalid_value', values: t.values, input: s, inst: e }),
              n
            )
          }))
      })
    function tO(e, t) {
      return e.issues.length && void 0 === t ? { issues: [], value: void 0 } : e
    }
    let tS = ek('$ZodOptional', (e, t) => {
        ;(tr.init(e, t),
          (e._zod.optin = 'optional'),
          (e._zod.optout = 'optional'),
          eR(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, void 0]) : void 0,
          ),
          eR(e._zod, 'pattern', () => {
            let e = t.innerType._zod.pattern
            return e ? RegExp(`^(${eA(e.source)})?$`) : void 0
          }),
          (e._zod.parse = (e, i) => {
            if ('optional' === t.innerType._zod.optin) {
              let n = t.innerType._zod.run(e, i)
              return n instanceof Promise ? n.then((t) => tO(t, e.value)) : tO(n, e.value)
            }
            return void 0 === e.value ? e : t.innerType._zod.run(e, i)
          }))
      }),
      tE = ek('$ZodNullable', (e, t) => {
        ;(tr.init(e, t),
          eR(e._zod, 'optin', () => t.innerType._zod.optin),
          eR(e._zod, 'optout', () => t.innerType._zod.optout),
          eR(e._zod, 'pattern', () => {
            let e = t.innerType._zod.pattern
            return e ? RegExp(`^(${eA(e.source)}|null)$`) : void 0
          }),
          eR(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, null]) : void 0,
          ),
          (e._zod.parse = (e, i) => (null === e.value ? e : t.innerType._zod.run(e, i))))
      }),
      tk = ek('$ZodPrefault', (e, t) => {
        ;(tr.init(e, t),
          (e._zod.optin = 'optional'),
          eR(e._zod, 'values', () => t.innerType._zod.values),
          (e._zod.parse = (e, i) => (
            'backward' === i.direction || (void 0 === e.value && (e.value = t.defaultValue)),
            t.innerType._zod.run(e, i)
          )))
      }),
      tx = ek('$ZodLazy', (e, t) => {
        ;(tr.init(e, t),
          eR(e._zod, 'innerType', () => t.getter()),
          eR(e._zod, 'pattern', () => e._zod.innerType?._zod?.pattern),
          eR(e._zod, 'propValues', () => e._zod.innerType?._zod?.propValues),
          eR(e._zod, 'optin', () => e._zod.innerType?._zod?.optin ?? void 0),
          eR(e._zod, 'optout', () => e._zod.innerType?._zod?.optout ?? void 0),
          (e._zod.parse = (t, i) => e._zod.innerType._zod.run(t, i)))
      })
    ;(Symbol('ZodOutput'), Symbol('ZodInput'))
    function tP(e, t) {
      return new te({ check: 'min_length', ...eN(t), minimum: e })
    }
    ;(f = globalThis).__zod_globalRegistry ??
      (f.__zod_globalRegistry = new (class e {
        constructor() {
          ;((this._map = new WeakMap()), (this._idmap = new Map()))
        }
        add(e, ...t) {
          let i = t[0]
          return (
            this._map.set(e, i),
            i && 'object' == typeof i && 'id' in i && this._idmap.set(i.id, e),
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
            let i = { ...(this.get(t) ?? {}) }
            delete i.id
            let n = { ...i, ...this._map.get(e) }
            return Object.keys(n).length ? n : void 0
          }
          return this._map.get(e)
        }
        has(e) {
          return this._map.has(e)
        }
      })())
    let t$ = ek('ZodMiniType', (e, t) => {
        if (!e._zod) throw Error('Uninitialized schema in ZodMiniType.')
        ;(tr.init(e, t),
          (e.def = t),
          (e.type = t.type),
          (e.parse = (t, i) => eX(e, t, i, { callee: e.parse })),
          (e.safeParse = (t, i) => e0(e, t, i)),
          (e.parseAsync = async (t, i) => eY(e, t, i, { callee: e.parseAsync })),
          (e.safeParseAsync = async (t, i) => e1(e, t, i)),
          (e.check = (...i) =>
            e.clone(
              {
                ...t,
                checks: [
                  ...(t.checks ?? []),
                  ...i.map((e) =>
                    'function' == typeof e
                      ? { _zod: { check: e, def: { check: 'custom' }, onattach: [] } }
                      : e,
                  ),
                ],
              },
              { parent: !0 },
            )),
          (e.with = e.check),
          (e.clone = (t, i) => eZ(e, t, i)),
          (e.brand = () => e),
          (e.register = (t, i) => (t.add(e, i), e)),
          (e.apply = (t) => t(e)))
      }),
      tj = ek('ZodMiniString', (e, t) => {
        ;(ts.init(e, t), t$.init(e, t))
      })
    function tI(e) {
      return new tj({ type: 'string', ...eN(e) })
    }
    let tT = ek('ZodMiniStringFormat', (e, t) => {
        ;(to.init(e, t), tj.init(e, t))
      }),
      tA = ek('ZodMiniNumber', (e, t) => {
        ;(tl.init(e, t), t$.init(e, t))
      })
    function tF(e) {
      return new tA({ type: 'number', checks: [], ...eN(e) })
    }
    let tR = ek('ZodMiniBoolean', (e, t) => {
      ;(tu.init(e, t), t$.init(e, t))
    })
    function tC(e) {
      return new tR({ type: 'boolean', ...eN(e) })
    }
    let tM = ek('ZodMiniNull', (e, t) => {
      ;(tc.init(e, t), t$.init(e, t))
    })
    function tB(e) {
      return new tM({ type: 'null', ...eN(e) })
    }
    let tq = ek('ZodMiniAny', (e, t) => {
      ;(td.init(e, t), t$.init(e, t))
    })
    function tU() {
      return new tq({ type: 'any' })
    }
    let tZ = ek('ZodMiniUnknown', (e, t) => {
        ;(tp.init(e, t), t$.init(e, t))
      }),
      tN = ek('ZodMiniArray', (e, t) => {
        ;(th.init(e, t), t$.init(e, t))
      })
    function tV(e, t) {
      return new tN({ type: 'array', element: e, ...eN(t) })
    }
    let tD = ek('ZodMiniObject', (e, t) => {
      ;(ty.init(e, t), t$.init(e, t), eR(e, 'shape', () => t.shape))
    })
    function tL(e, t) {
      return new tD({ type: 'object', shape: e ?? {}, ...eN(t) })
    }
    function tQ(e, t) {
      if (!eB(t)) throw Error('Invalid input to extend: expected a plain object')
      let i = e._zod.def.checks
      if (i && i.length > 0) {
        let i = e._zod.def.shape
        for (let e in t)
          if (void 0 !== Object.getOwnPropertyDescriptor(i, e))
            throw Error(
              'Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.',
            )
      }
      let n = (function (...e) {
        let t = {}
        for (let i of e) Object.assign(t, Object.getOwnPropertyDescriptors(i))
        return Object.defineProperties({}, t)
      })(e._zod.def, {
        get shape() {
          let i = { ...e._zod.def.shape, ...t }
          return (
            Object.defineProperty(this, 'shape', {
              value: i,
              writable: !0,
              enumerable: !0,
              configurable: !0,
            }),
            i
          )
        },
      })
      return eZ(e, n)
    }
    function tJ(e, t) {
      return e.clone({ ...e._zod.def, catchall: t })
    }
    let tH = ek('ZodMiniUnion', (e, t) => {
      ;(tm.init(e, t), t$.init(e, t))
    })
    function tK(e, t) {
      return new tH({ type: 'union', options: e, ...eN(t) })
    }
    let tW = ek('ZodMiniDiscriminatedUnion', (e, t) => {
      ;(tb.init(e, t), t$.init(e, t))
    })
    function tG(e, t, i) {
      return new tW({ type: 'union', options: t, discriminator: e, ...eN(i) })
    }
    let tX = ek('ZodMiniRecord', (e, t) => {
      ;(tw.init(e, t), t$.init(e, t))
    })
    function tY(e, t, i) {
      return new tX({ type: 'record', keyType: e, valueType: t, ...eN(i) })
    }
    let t0 = ek('ZodMiniEnum', (e, t) => {
      ;(t_.init(e, t), t$.init(e, t), (e.options = Object.values(t.entries)))
    })
    function t1(e, t) {
      return new t0({
        type: 'enum',
        entries: Array.isArray(e) ? Object.fromEntries(e.map((e) => [e, e])) : e,
        ...eN(t),
      })
    }
    let t2 = ek('ZodMiniLiteral', (e, t) => {
      ;(tz.init(e, t), t$.init(e, t))
    })
    function t6(e, t) {
      return new t2({ type: 'literal', values: Array.isArray(e) ? e : [e], ...eN(t) })
    }
    let t3 = ek('ZodMiniOptional', (e, t) => {
      ;(tS.init(e, t), t$.init(e, t))
    })
    function t4(e) {
      return new t3({ type: 'optional', innerType: e })
    }
    let t8 = ek('ZodMiniNullable', (e, t) => {
      ;(tE.init(e, t), t$.init(e, t))
    })
    function t5(e) {
      return new t8({ type: 'nullable', innerType: e })
    }
    let t9 = ek('ZodMiniPrefault', (e, t) => {
        ;(tk.init(e, t), t$.init(e, t))
      }),
      t7 = ek('ZodMiniLazy', (e, t) => {
        ;(tx.init(e, t), t$.init(e, t))
      })
    function ie() {
      let e = new t7({
        type: 'lazy',
        getter: () => tK([tI(), tF(), tC(), tB(), tV(e), tY(tI(), e)]),
      })
      return e
    }
    let it = ek('ZodMiniISODateTime', (e, t) => {
      ;(ta.init(e, t), tT.init(e, t))
    })
    function ii(e) {
      return new it({
        type: 'string',
        format: 'datetime',
        check: 'string_format',
        offset: !1,
        local: !1,
        precision: null,
        ...eN(e),
      })
    }
    let ir = tJ(tL({}), ie()),
      is = tL({ sys: tL({ type: t6('Link'), linkType: tI(), id: tI() }) }),
      io = tL({ sys: tL({ type: t6('Link'), linkType: t6('ContentType'), id: tI() }) }),
      ia = tL({ sys: tL({ type: t6('Link'), linkType: t6('Environment'), id: tI() }) }),
      il = tL({ sys: tL({ type: t6('Link'), linkType: t6('Space'), id: tI() }) }),
      iu = tL({ sys: tL({ type: t6('Link'), linkType: t6('TaxonomyConcept'), id: tI() }) }),
      ic = tL({ sys: tL({ type: t6('Link'), linkType: t6('Tag'), id: tI() }) }),
      id = tL({
        type: t6('Entry'),
        contentType: io,
        publishedVersion: tF(),
        id: tI(),
        createdAt: tU(),
        updatedAt: tU(),
        locale: t4(tI()),
        revision: tF(),
        space: il,
        environment: ia,
      }),
      ip = tL({ fields: ir, metadata: tL({ tags: tV(ic), concepts: t4(tV(iu)) }), sys: id }),
      ih = tQ(ir, { nt_audience_id: tI(), nt_name: t4(tI()), nt_description: t4(tI()) }),
      iv = tQ(ip, { fields: ih })
    tL({ contentTypeId: t6('nt_audience'), fields: ih })
    let iy = tQ(ip, {
        fields: tL({ nt_name: tI(), nt_fallback: t4(tI()), nt_mergetag_id: tI() }),
        sys: tQ(id, {
          contentType: tL({
            sys: tL({ type: t6('Link'), linkType: t6('ContentType'), id: t6('nt_mergetag') }),
          }),
        }),
      }),
      ig = tL({ id: tI(), hidden: t4(tC()) }),
      im = tL({ type: t4(t6('EntryReplacement')), baseline: ig, variants: tV(ig) }),
      ib = tL({ value: tK([tI(), tC(), tB(), tF(), tY(tI(), ie())]) }),
      iw = t1(['Boolean', 'Number', 'Object', 'String']),
      i_ = tG('type', [
        im,
        tL({
          type: t6('InlineVariable'),
          key: tI(),
          valueType: iw,
          baseline: ib,
          variants: tV(ib),
        }),
      ]),
      iz = tV(i_),
      iO = tL({
        distribution: t4(tV(tF())),
        traffic: t4(tF()),
        components: t4(iz),
        sticky: t4(tC()),
      }),
      iS = tK([t6('nt_experiment'), t6('nt_personalization')]),
      iE = tQ(ir, {
        nt_name: tI(),
        nt_description: t4(t5(tI())),
        nt_type: iS,
        nt_config: t4(t5(iO)),
        nt_audience: t4(t5(iv)),
        nt_variants: t4(tV(tK([is, ip]))),
        nt_experience_id: tI(),
      }),
      ik = tQ(ip, { fields: iE })
    tL({ contentTypeId: t6('nt_experience'), fields: iE })
    let ix = tQ(ip, { fields: tQ(ir, { nt_experiences: tV(tK([is, ik])) }) })
    function iP(e) {
      return ik.safeParse(e).success
    }
    function i$(e) {
      return ix.safeParse(e).success
    }
    let ij = t4(tL({ name: tI(), version: tI() })),
      iI = tL({
        name: t4(tI()),
        source: t4(tI()),
        medium: t4(tI()),
        term: t4(tI()),
        content: t4(tI()),
      }),
      iT = tK([t6('mobile'), t6('server'), t6('web')]),
      iA = tY(tI(), tI()),
      iF = tL({ latitude: tF(), longitude: tF() }),
      iR = tL({
        coordinates: t4(iF),
        city: t4(tI()),
        postalCode: t4(tI()),
        region: t4(tI()),
        regionCode: t4(tI()),
        country: t4(tI()),
        countryCode: t4(tI().check(new tt({ check: 'length_equals', ...eN(void 0), length: 2 }))),
        continent: t4(tI()),
        timezone: t4(tI()),
      }),
      iC = tL({ name: tI(), version: tI() }),
      iM = tJ(
        tL({ path: tI(), query: iA, referrer: tI(), search: tI(), title: t4(tI()), url: tI() }),
        ie(),
      ),
      iB = tY(tI(), ie()),
      iq = tJ(tL({ name: tI() }), ie()),
      iU = tY(tI(), ie()),
      iZ = tL({
        app: ij,
        campaign: iI,
        gdpr: tL({ isConsentGiven: tC() }),
        library: iC,
        locale: tI(),
        location: t4(iR),
        userAgent: t4(tI()),
      }),
      iN = tL({
        channel: iT,
        context: tQ(iZ, { page: t4(iM), screen: t4(iq) }),
        messageId: tI(),
        originalTimestamp: ii(),
        sentAt: ii(),
        timestamp: ii(),
        userId: t4(tI()),
      }),
      iV = tQ(iN, { type: t6('alias') }),
      iD = tQ(iN, { type: t6('group') }),
      iL = tQ(iN, { type: t6('identify'), traits: iU }),
      iQ = tQ(iZ, { page: iM }),
      iJ = tQ(iN, { type: t6('page'), name: t4(tI()), properties: iM, context: iQ }),
      iH = tQ(iZ, { screen: iq }),
      iK = tQ(iN, { type: t6('screen'), name: tI(), properties: t4(iB), context: iH }),
      iW = tQ(iN, { type: t6('track'), event: tI(), properties: iB }),
      iG = tQ(iN, {
        componentType: tK([t6('Entry'), t6('Variable')]),
        componentId: tI(),
        experienceId: t4(tI()),
        variantIndex: tF(),
      }),
      iX = tQ(iG, { type: t6('component'), viewDurationMs: t4(tF()), viewId: t4(tI()) }),
      iY = { anonymousId: tI() },
      i0 = tV(
        tG('type', [
          tQ(iV, iY),
          tQ(iX, iY),
          tQ(iD, iY),
          tQ(iL, iY),
          tQ(iJ, iY),
          tQ(iK, iY),
          tQ(iW, iY),
        ]),
      ),
      i1 = tG('type', [iV, iX, iD, iL, iJ, iK, iW]),
      i2 = tV(i1),
      i6 = tL({ features: t4(tV(tI())) }),
      i3 = tL({ events: i2.check(tP(1)), options: t4(i6) }),
      i4 = tL({ events: i0.check(tP(1)), options: t4(i6) }),
      i8 = tL({
        id: tI(),
        isReturningVisitor: tC(),
        landingPage: iM,
        count: tF(),
        activeSessionLength: tF(),
        averageSessionLength: tF(),
      }),
      i5 = tL({
        id: tI(),
        stableId: tI(),
        random: tF(),
        audiences: tV(tI()),
        traits: iU,
        location: iR,
        session: i8,
      }),
      i9 = tJ(tL({ id: tI() }), ie()),
      i7 = tL({ data: tL(), message: tI(), error: t5(tC()) }),
      ne = tQ(i7, { data: tL({ profiles: t4(tV(i5)) }) }),
      nt = tL({
        key: tI(),
        type: tK([t1(['Variable']), tI()]),
        meta: tL({ experienceId: tI(), variantIndex: tF() }),
      }),
      ni = tK([tI(), tC(), tB(), tF(), tY(tI(), ie())])
    tQ(nt, { type: tI(), value: new tZ({ type: 'unknown' }) })
    let nn = tV(tG('type', [tQ(nt, { type: t6('Variable'), value: ni })])),
      nr = tV(
        tL({
          experienceId: tI(),
          variantIndex: tF(),
          variants: tY(tI(), tI()),
          sticky: t4(
            ((d = tC()),
            new t9({
              type: 'prefault',
              innerType: d,
              get defaultValue() {
                return 'function' == typeof !1
                  ? (!1)()
                  : eB(!1)
                    ? { ...!1 }
                    : !!Array.isArray(!1) && [...!1]
              },
            })),
          ),
        }),
      ),
      ns = tQ(i7, { data: tL({ profile: i5, experiences: nr, changes: nn }) }),
      no = tG('type', [
        iX,
        tQ(iG, { type: t6('component_click') }),
        tQ(iG, { type: t6('component_hover'), hoverDurationMs: tF(), hoverId: tI() }),
      ]),
      na = tL({ profile: i9, events: tV(no) }),
      nl = tV(na)
    function nu(e, t) {
      let i = e.safeParse(t)
      if (i.success) return i.data
      throw Error(
        (function (e) {
          let t = []
          for (let i of [...e.issues].sort((e, t) => (e.path ?? []).length - (t.path ?? []).length))
            (t.push(`✖ ${i.message}`),
              i.path?.length &&
                t.push(
                  `  → at ${(function (e) {
                    let t = []
                    for (let i of e.map((e) => ('object' == typeof e ? e.key : e)))
                      'number' == typeof i
                        ? t.push(`[${i}]`)
                        : 'symbol' == typeof i
                          ? t.push(`[${JSON.stringify(String(i))}]`)
                          : /[^\w$]/.test(i)
                            ? t.push(`[${JSON.stringify(i)}]`)
                            : (t.length && t.push('.'), t.push(i))
                    return t.join('')
                  })(i.path)}`,
                ))
          return t.join('\n')
        })(i.error),
      )
    }
    e$({
      localeError:
        ((r = {
          string: { unit: 'characters', verb: 'to have' },
          file: { unit: 'bytes', verb: 'to have' },
          array: { unit: 'items', verb: 'to have' },
          set: { unit: 'items', verb: 'to have' },
          map: { unit: 'entries', verb: 'to have' },
        }),
        (s = {
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
        (o = { nan: 'NaN' }),
        (e) => {
          switch (e.code) {
            case 'invalid_type': {
              let t = o[e.expected] ?? e.expected,
                i = (function (e) {
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
                n = o[i] ?? i
              return `Invalid input: expected ${t}, received ${n}`
            }
            case 'invalid_value':
              if (1 === e.values.length) return `Invalid input: expected ${eV(e.values[0])}`
              return `Invalid option: expected one of ${ej(e.values, '|')}`
            case 'too_big': {
              let t = e.inclusive ? '<=' : '<',
                i = r[e.origin] ?? null
              if (i)
                return `Too big: expected ${e.origin ?? 'value'} to have ${t}${e.maximum.toString()} ${i.unit ?? 'elements'}`
              return `Too big: expected ${e.origin ?? 'value'} to be ${t}${e.maximum.toString()}`
            }
            case 'too_small': {
              let t = e.inclusive ? '>=' : '>',
                i = r[e.origin] ?? null
              if (i)
                return `Too small: expected ${e.origin} to have ${t}${e.minimum.toString()} ${i.unit}`
              return `Too small: expected ${e.origin} to be ${t}${e.minimum.toString()}`
            }
            case 'invalid_format':
              if ('starts_with' === e.format) return `Invalid string: must start with "${e.prefix}"`
              if ('ends_with' === e.format) return `Invalid string: must end with "${e.suffix}"`
              if ('includes' === e.format) return `Invalid string: must include "${e.includes}"`
              if ('regex' === e.format) return `Invalid string: must match pattern ${e.pattern}`
              return `Invalid ${s[e.format] ?? e.format}`
            case 'not_multiple_of':
              return `Invalid number: must be a multiple of ${e.divisor}`
            case 'unrecognized_keys':
              return `Unrecognized key${e.keys.length > 1 ? 's' : ''}: ${ej(e.keys, ', ')}`
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
    let nc = new (class {
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
      debug(e, t, ...i) {
        this.emit('debug', e, t, ...i)
      }
      info(e, t, ...i) {
        this.emit('info', e, t, ...i)
      }
      log(e, t, ...i) {
        this.emit('log', e, t, ...i)
      }
      warn(e, t, ...i) {
        this.emit('warn', e, t, ...i)
      }
      error(e, t, ...i) {
        this.emit('error', e, t, ...i)
      }
      fatal(e, t, ...i) {
        this.emit('fatal', e, t, ...i)
      }
      emit(e, t, i, ...n) {
        this.onLogEvent({
          name: this.name,
          level: e,
          messages: [`${this.assembleLocationPrefix(t)} ${String(i)}`, ...n],
        })
      }
      onLogEvent(e) {
        this.sinks.forEach((t) => {
          t.ingest(e)
        })
      }
    })()
    function nd(e) {
      return {
        debug: (t, ...i) => {
          nc.debug(e, t, ...i)
        },
        info: (t, ...i) => {
          nc.info(e, t, ...i)
        },
        log: (t, ...i) => {
          nc.log(e, t, ...i)
        },
        warn: (t, ...i) => {
          nc.warn(e, t, ...i)
        },
        error: (t, ...i) => {
          nc.error(e, t, ...i)
        },
        fatal: (t, ...i) => {
          nc.fatal(e, t, ...i)
        },
      }
    }
    let np = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, log: 10 },
      nf = class {},
      nh = {
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
    class nv extends nf {
      name = 'ConsoleLogSink'
      verbosity
      constructor(e) {
        ;(super(), (this.verbosity = e ?? 'error'))
      }
      ingest(e) {
        np[e.level] < np[this.verbosity] || nh[e.level](...e.messages)
      }
    }
    let ny = nd('ApiClient:Retry')
    class ng extends Error {
      status
      constructor(e, t = 500) {
        ;(super(e), Object.setPrototypeOf(this, ng.prototype), (this.status = t))
      }
    }
    async function nm(e) {
      if (e <= 0) return
      let { promise: t, resolve: i } = Promise.withResolvers()
      ;(setTimeout(() => {
        i(void 0)
      }, e),
        await t)
    }
    let nb = nd('ApiClient:Timeout'),
      nw = nd('ApiClient:Fetch'),
      n_ = function (e) {
        try {
          let t = (function ({
            apiName: e = 'Optimization',
            fetchMethod: t = fetch,
            onRequestTimeout: i,
            requestTimeout: n = 3e3,
          } = {}) {
            return async (r, s) => {
              let o = new AbortController(),
                a = setTimeout(() => {
                  ;('function' == typeof i
                    ? i({ apiName: e })
                    : nb.error(`Request to "${r.toString()}" timed out`, Error('Request timeout')),
                    o.abort())
                }, n),
                l = await t(r, { ...s, signal: o.signal })
              return (clearTimeout(a), l)
            }
          })(e)
          return (function ({
            apiName: e = 'Optimization',
            fetchMethod: t = fetch,
            intervalTimeout: i = 0,
            onFailedAttempt: n,
            retries: r = 1,
          } = {}) {
            return async (s, o) => {
              let a = new AbortController(),
                l = r + 1,
                u = (function ({
                  apiName: e = 'Optimization',
                  controller: t,
                  fetchMethod: i = fetch,
                  init: n,
                  url: r,
                }) {
                  return async () => {
                    try {
                      let s = await i(r, n)
                      if (503 === s.status)
                        throw new ng(
                          `${e} API request to "${r.toString()}" failed with status: "[${s.status}] ${s.statusText}".`,
                          503,
                        )
                      if (!s.ok) {
                        let e = Error(
                          `Request to "${r.toString()}" failed with status: [${s.status}] ${s.statusText} - traceparent: ${s.headers.get('traceparent')}`,
                        )
                        ;(ny.error('Request failed with non-OK status:', e), t.abort())
                        return
                      }
                      return (ny.debug(`Response from "${r.toString()}":`, s), s)
                    } catch (e) {
                      if (e instanceof ng && 503 === e.status) throw e
                      ;(ny.error(`Request to "${r.toString()}" failed:`, e), t.abort())
                    }
                  }
                })({ apiName: e, controller: a, fetchMethod: t, init: o, url: s })
              for (let t = 1; t <= l; t++)
                try {
                  let e = await u()
                  if (e) return e
                  break
                } catch (s) {
                  if (!(s instanceof ng) || 503 !== s.status) throw s
                  let r = l - t
                  if ((n?.({ apiName: e, error: s, attemptNumber: t, retriesLeft: r }), 0 === r))
                    throw s
                  await nm(i)
                }
              throw Error(`${e} API request to "${s.toString()}" may not be retried.`)
            }
          })({ ...e, fetchMethod: t })
        } catch (e) {
          throw (
            e instanceof Error &&
              ('AbortError' === e.name
                ? nw.warn('Request aborted due to network issues. This request may not be retried.')
                : nw.error('Request failed:', e)),
            e
          )
        }
      },
      nz = nd('ApiClient'),
      nO = class {
        name
        clientId
        environment
        fetch
        constructor(e, { fetchOptions: t, clientId: i, environment: n }) {
          ;((this.clientId = i),
            (this.environment = n ?? 'main'),
            (this.name = e),
            (this.fetch = n_({ ...(t ?? {}), apiName: e })))
        }
        logRequestError(e, { requestName: t }) {
          e instanceof Error &&
            ('AbortError' === e.name
              ? nz.warn(
                  `[${this.name}] "${t}" request aborted due to network issues. This request may not be retried.`,
                )
              : nz.error(`[${this.name}] "${t}" request failed:`, e))
        }
      },
      nS = nd('ApiClient:Experience')
    class nE extends nO {
      baseUrl
      enabledFeatures
      ip
      locale
      plainText
      preflight
      constructor(e) {
        super('Experience', e)
        const { baseUrl: t, enabledFeatures: i, ip: n, locale: r, plainText: s, preflight: o } = e
        ;((this.baseUrl = t || 'https://experience.ninetailed.co/'),
          (this.enabledFeatures = i),
          (this.ip = n),
          (this.locale = r),
          (this.plainText = s),
          (this.preflight = o))
      }
      async getProfile(e, t = {}) {
        if (!e) throw Error('Valid profile ID required.')
        let i = 'Get Profile'
        nS.info(`Sending "${i}" request`)
        try {
          let n = await this.fetch(
              this.constructUrl(
                `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${e}`,
                t,
              ),
              { method: 'GET' },
            ),
            {
              data: { changes: r, experiences: s, profile: o },
            } = nu(ns, await n.json())
          return (
            nS.debug(`"${i}" request successfully completed`),
            { changes: r, selectedOptimizations: s, profile: o }
          )
        } catch (e) {
          throw (this.logRequestError(e, { requestName: i }), e)
        }
      }
      async makeProfileMutationRequest({ url: e, body: t, options: i }) {
        return await this.fetch(this.constructUrl(e, i), {
          method: 'POST',
          headers: this.constructHeaders(i),
          body: JSON.stringify(t),
          keepalive: !0,
        })
      }
      async createProfile({ events: e }, t = {}) {
        let i = 'Create Profile'
        nS.info(`Sending "${i}" request`)
        let n = this.constructExperienceRequestBody(e, t)
        nS.debug(`"${i}" request body:`, n)
        try {
          let e = await this.makeProfileMutationRequest({
              url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles`,
              body: n,
              options: t,
            }),
            {
              data: { changes: r, experiences: s, profile: o },
            } = nu(ns, await e.json())
          return (
            nS.debug(`"${i}" request successfully completed`),
            { changes: r, selectedOptimizations: s, profile: o }
          )
        } catch (e) {
          throw (this.logRequestError(e, { requestName: i }), e)
        }
      }
      async updateProfile({ profileId: e, events: t }, i = {}) {
        if (!e) throw Error('Valid profile ID required.')
        let n = 'Update Profile'
        nS.info(`Sending "${n}" request`)
        let r = this.constructExperienceRequestBody(t, i)
        nS.debug(`"${n}" request body:`, r)
        try {
          let t = await this.makeProfileMutationRequest({
              url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${e}`,
              body: r,
              options: i,
            }),
            {
              data: { changes: s, experiences: o, profile: a },
            } = nu(ns, await t.json())
          return (
            nS.debug(`"${n}" request successfully completed`),
            { changes: s, selectedOptimizations: o, profile: a }
          )
        } catch (e) {
          throw (this.logRequestError(e, { requestName: n }), e)
        }
      }
      async upsertProfile({ profileId: e, events: t }, i) {
        return e
          ? await this.updateProfile({ profileId: e, events: t }, i)
          : await this.createProfile({ events: t }, i)
      }
      async upsertManyProfiles({ events: e }, t = {}) {
        let i = 'Upsert Many Profiles'
        nS.info(`Sending "${i}" request`)
        let n = nu(i4, { events: e, options: this.constructBodyOptions(t) })
        nS.debug(`"${i}" request body:`, n)
        try {
          let e = await this.makeProfileMutationRequest({
              url: `v2/organizations/${this.clientId}/environments/${this.environment}/events`,
              body: n,
              options: { plainText: !1, ...t },
            }),
            {
              data: { profiles: r },
            } = nu(ne, await e.json())
          return (nS.debug(`"${i}" request successfully completed`), r)
        } catch (e) {
          throw (this.logRequestError(e, { requestName: i }), e)
        }
      }
      constructUrl(e, t) {
        let i = new URL(e, this.baseUrl),
          n = t.locale ?? this.locale,
          r = t.preflight ?? this.preflight
        return (
          n && i.searchParams.set('locale', n),
          r && i.searchParams.set('type', 'preflight'),
          i.toString()
        )
      }
      constructHeaders({ ip: e = this.ip, plainText: t = this.plainText }) {
        let i = new Map()
        return (
          e && i.set('X-Force-IP', e),
          (t ?? this.plainText ?? !0)
            ? i.set('Content-Type', 'text/plain')
            : i.set('Content-Type', 'application/json'),
          Object.fromEntries(i)
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
        return i3.parse({ events: nu(i2, e), options: this.constructBodyOptions(t) })
      }
    }
    let nk = nd('ApiClient:Insights')
    class nx extends nO {
      baseUrl
      beaconHandler
      constructor(e) {
        super('Insights', e)
        const { baseUrl: t, beaconHandler: i } = e
        ;((this.baseUrl = t || 'https://ingest.insights.ninetailed.co/'), (this.beaconHandler = i))
      }
      async sendBatchEvents(e, t = {}) {
        let { beaconHandler: i = this.beaconHandler } = t,
          n = new URL(
            `v1/organizations/${this.clientId}/environments/${this.environment}/events`,
            this.baseUrl,
          ),
          r = nu(nl, e)
        if ('function' == typeof i) {
          if ((nk.debug('Queueing events via beaconHandler'), i(n, r))) return !0
          nk.warn(
            'beaconHandler failed to queue events; events will be emitted immediately via fetch',
          )
        }
        let s = 'Event Batches'
        ;(nk.info(`Sending "${s}" request`), nk.debug(`"${s}" request body:`, r))
        try {
          return (
            await this.fetch(n, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r),
              keepalive: !0,
            }),
            nk.debug(`"${s}" request successfully completed`),
            !0
          )
        } catch (e) {
          return (this.logRequestError(e, { requestName: s }), !1)
        }
      }
    }
    class nP {
      config
      experience
      insights
      constructor(e) {
        const { experience: t, insights: i, clientId: n, environment: r, fetchOptions: s } = e,
          o = { clientId: n, environment: r, fetchOptions: s }
        ;((this.config = o),
          (this.experience = new nE({ ...o, ...t })),
          (this.insights = new nx({ ...o, ...i })))
      }
    }
    function n$(e) {
      if (!e || 'object' != typeof e) return !1
      let t = Object.getPrototypeOf(e)
      return (
        (null === t || t === Object.prototype || null === Object.getPrototypeOf(t)) &&
        '[object Object]' === Object.prototype.toString.call(e)
      )
    }
    function nj(e) {
      return n$(e) || Array.isArray(e)
    }
    function nI(e, t, i) {
      function n(i, n) {
        if (
          (i._zod ||
            Object.defineProperty(i, '_zod', {
              value: { def: n, constr: o, traits: new Set() },
              enumerable: !1,
            }),
          i._zod.traits.has(e))
        )
          return
        ;(i._zod.traits.add(e), t(i, n))
        let r = o.prototype,
          s = Object.keys(r)
        for (let e = 0; e < s.length; e++) {
          let t = s[e]
          t in i || (i[t] = r[t].bind(i))
        }
      }
      let r = i?.Parent ?? Object
      class s extends r {}
      function o(e) {
        var t
        let r = i?.Parent ? new s() : this
        for (let i of (n(r, e), (t = r._zod).deferred ?? (t.deferred = []), r._zod.deferred)) i()
        return r
      }
      return (
        Object.defineProperty(s, 'name', { value: e }),
        Object.defineProperty(o, 'init', { value: n }),
        Object.defineProperty(o, Symbol.hasInstance, {
          value: (t) => (!!i?.Parent && t instanceof i.Parent) || t?._zod?.traits?.has(e),
        }),
        Object.defineProperty(o, 'name', { value: e }),
        o
      )
    }
    ;(Object.freeze({ status: 'aborted' }), Symbol('zod_brand'))
    class nT extends Error {
      constructor() {
        super('Encountered Promise during synchronous parse. Use .parseAsync() instead.')
      }
    }
    let nA = {}
    function nF(e) {
      return (e && Object.assign(nA, e), nA)
    }
    function nR(e, t) {
      return 'bigint' == typeof t ? t.toString() : t
    }
    function nC(e) {
      return {
        get value() {
          {
            let t = e()
            return (Object.defineProperty(this, 'value', { value: t }), t)
          }
        },
      }
    }
    let nM = Symbol('evaluating')
    function nB(e, t, i) {
      let n
      Object.defineProperty(e, t, {
        get() {
          if (n !== nM) return (void 0 === n && ((n = nM), (n = i())), n)
        },
        set(i) {
          Object.defineProperty(e, t, { value: i })
        },
        configurable: !0,
      })
    }
    function nq(e, t, i) {
      Object.defineProperty(e, t, { value: i, writable: !0, enumerable: !0, configurable: !0 })
    }
    function nU(...e) {
      let t = {}
      for (let i of e) Object.assign(t, Object.getOwnPropertyDescriptors(i))
      return Object.defineProperties({}, t)
    }
    let nZ = 'captureStackTrace' in Error ? Error.captureStackTrace : (...e) => {}
    function nN(e) {
      return 'object' == typeof e && null !== e && !Array.isArray(e)
    }
    function nV(e) {
      if (!1 === nN(e)) return !1
      let t = e.constructor
      if (void 0 === t || 'function' != typeof t) return !0
      let i = t.prototype
      return !1 !== nN(i) && !1 !== Object.prototype.hasOwnProperty.call(i, 'isPrototypeOf')
    }
    function nD(e, t, i) {
      let n = new e._zod.constr(t ?? e._zod.def)
      return ((!t || i?.parent) && (n._zod.parent = e), n)
    }
    function nL(e) {
      if (!e) return {}
      if ('string' == typeof e) return { error: () => e }
      if (e?.message !== void 0) {
        if (e?.error !== void 0) throw Error('Cannot specify both `message` and `error` params')
        e.error = e.message
      }
      return (delete e.message, 'string' == typeof e.error) ? { ...e, error: () => e.error } : e
    }
    function nQ(e, t = 0) {
      if (!0 === e.aborted) return !0
      for (let i = t; i < e.issues.length; i++) if (e.issues[i]?.continue !== !0) return !0
      return !1
    }
    function nJ(e) {
      return 'string' == typeof e ? e : e?.message
    }
    function nH(e, t, i) {
      let n = { ...e, path: e.path ?? [] }
      return (
        e.message ||
          (n.message =
            nJ(e.inst?._zod.def?.error?.(e)) ??
            nJ(t?.error?.(e)) ??
            nJ(i.customError?.(e)) ??
            nJ(i.localeError?.(e)) ??
            'Invalid input'),
        delete n.inst,
        delete n.continue,
        t?.reportInput || delete n.input,
        n
      )
    }
    nC(() => {
      if ('u' > typeof navigator && navigator?.userAgent?.includes('Cloudflare')) return !1
      try {
        return (Function(''), !0)
      } catch (e) {
        return !1
      }
    })
    let nK = (e, t) => {
        ;((e.name = '$ZodError'),
          Object.defineProperty(e, '_zod', { value: e._zod, enumerable: !1 }),
          Object.defineProperty(e, 'issues', { value: t, enumerable: !1 }),
          (e.message = JSON.stringify(t, nR, 2)),
          Object.defineProperty(e, 'toString', { value: () => e.message, enumerable: !1 }))
      },
      nW = nI('$ZodError', nK),
      nG = nI('$ZodError', nK, { Parent: Error }),
      nX =
        ((a = nG),
        (e, t, i, n) => {
          let r = i ? Object.assign(i, { async: !1 }) : { async: !1 },
            s = e._zod.run({ value: t, issues: [] }, r)
          if (s instanceof Promise) throw new nT()
          if (s.issues.length) {
            let e = new (n?.Err ?? a)(s.issues.map((e) => nH(e, r, nF())))
            throw (nZ(e, n?.callee), e)
          }
          return s.value
        }),
      nY =
        ((l = nG),
        async (e, t, i, n) => {
          let r = i ? Object.assign(i, { async: !0 }) : { async: !0 },
            s = e._zod.run({ value: t, issues: [] }, r)
          if ((s instanceof Promise && (s = await s), s.issues.length)) {
            let e = new (n?.Err ?? l)(s.issues.map((e) => nH(e, r, nF())))
            throw (nZ(e, n?.callee), e)
          }
          return s.value
        }),
      n0 =
        ((u = nG),
        (e, t, i) => {
          let n = i ? { ...i, async: !1 } : { async: !1 },
            r = e._zod.run({ value: t, issues: [] }, n)
          if (r instanceof Promise) throw new nT()
          return r.issues.length
            ? { success: !1, error: new (u ?? nW)(r.issues.map((e) => nH(e, n, nF()))) }
            : { success: !0, data: r.value }
        }),
      n1 =
        ((c = nG),
        async (e, t, i) => {
          let n = i ? Object.assign(i, { async: !0 }) : { async: !0 },
            r = e._zod.run({ value: t, issues: [] }, n)
          return (
            r instanceof Promise && (r = await r),
            r.issues.length
              ? { success: !1, error: new c(r.issues.map((e) => nH(e, n, nF()))) }
              : { success: !0, data: r.value }
          )
        }),
      n2 = /^-?\d+(?:\.\d+)?$/,
      n6 = /^(?:true|false)$/i,
      n3 = { major: 4, minor: 3, patch: 6 },
      n4 = nI('$ZodType', (e, t) => {
        var i
        ;(e ?? (e = {}), (e._zod.def = t), (e._zod.bag = e._zod.bag || {}), (e._zod.version = n3))
        let n = [...(e._zod.def.checks ?? [])]
        for (let t of (e._zod.traits.has('$ZodCheck') && n.unshift(e), n))
          for (let i of t._zod.onattach) i(e)
        if (0 === n.length)
          ((i = e._zod).deferred ?? (i.deferred = []),
            e._zod.deferred?.push(() => {
              e._zod.run = e._zod.parse
            }))
        else {
          let t = (e, t, i) => {
              let n,
                r = nQ(e)
              for (let s of t) {
                if (s._zod.def.when) {
                  if (!s._zod.def.when(e)) continue
                } else if (r) continue
                let t = e.issues.length,
                  o = s._zod.check(e)
                if (o instanceof Promise && i?.async === !1) throw new nT()
                if (n || o instanceof Promise)
                  n = (n ?? Promise.resolve()).then(async () => {
                    ;(await o, e.issues.length !== t && (r || (r = nQ(e, t))))
                  })
                else {
                  if (e.issues.length === t) continue
                  r || (r = nQ(e, t))
                }
              }
              return n ? n.then(() => e) : e
            },
            i = (i, r, s) => {
              if (nQ(i)) return ((i.aborted = !0), i)
              let o = t(r, n, s)
              if (o instanceof Promise) {
                if (!1 === s.async) throw new nT()
                return o.then((t) => e._zod.parse(t, s))
              }
              return e._zod.parse(o, s)
            }
          e._zod.run = (r, s) => {
            if (s.skipChecks) return e._zod.parse(r, s)
            if ('backward' === s.direction) {
              let t = e._zod.parse({ value: r.value, issues: [] }, { ...s, skipChecks: !0 })
              return t instanceof Promise ? t.then((e) => i(e, r, s)) : i(t, r, s)
            }
            let o = e._zod.parse(r, s)
            if (o instanceof Promise) {
              if (!1 === s.async) throw new nT()
              return o.then((e) => t(e, n, s))
            }
            return t(o, n, s)
          }
        }
        nB(e, '~standard', () => ({
          validate: (t) => {
            try {
              let i = n0(e, t)
              return i.success ? { value: i.data } : { issues: i.error?.issues }
            } catch (i) {
              return n1(e, t).then((e) =>
                e.success ? { value: e.data } : { issues: e.error?.issues },
              )
            }
          },
          vendor: 'zod',
          version: 1,
        }))
      }),
      n8 = nI('$ZodString', (e, t) => {
        var i
        let n
        ;(n4.init(e, t),
          (e._zod.pattern =
            [...(e?._zod.bag?.patterns ?? [])].pop() ??
            ((n = (i = e._zod.bag)
              ? `[\\s\\S]{${i?.minimum ?? 0},${i?.maximum ?? ''}}`
              : '[\\s\\S]*'),
            RegExp(`^${n}$`))),
          (e._zod.parse = (i, n) => {
            if (t.coerce)
              try {
                i.value = String(i.value)
              } catch (e) {}
            return (
              'string' == typeof i.value ||
                i.issues.push({
                  expected: 'string',
                  code: 'invalid_type',
                  input: i.value,
                  inst: e,
                }),
              i
            )
          }))
      }),
      n5 = nI('$ZodNumber', (e, t) => {
        ;(n4.init(e, t),
          (e._zod.pattern = e._zod.bag.pattern ?? n2),
          (e._zod.parse = (i, n) => {
            if (t.coerce)
              try {
                i.value = Number(i.value)
              } catch (e) {}
            let r = i.value
            if ('number' == typeof r && !Number.isNaN(r) && Number.isFinite(r)) return i
            let s =
              'number' == typeof r
                ? Number.isNaN(r)
                  ? 'NaN'
                  : Number.isFinite(r)
                    ? void 0
                    : 'Infinity'
                : void 0
            return (
              i.issues.push({
                expected: 'number',
                code: 'invalid_type',
                input: r,
                inst: e,
                ...(s ? { received: s } : {}),
              }),
              i
            )
          }))
      }),
      n9 = nI('$ZodBoolean', (e, t) => {
        ;(n4.init(e, t),
          (e._zod.pattern = n6),
          (e._zod.parse = (i, n) => {
            if (t.coerce)
              try {
                i.value = !!i.value
              } catch (e) {}
            let r = i.value
            return (
              'boolean' == typeof r ||
                i.issues.push({ expected: 'boolean', code: 'invalid_type', input: r, inst: e }),
              i
            )
          }))
      })
    function n7(e, t, i, n, r) {
      if (e.issues.length) {
        if (r && !(i in n)) return
        t.issues.push(...e.issues.map((e) => (e.path ?? (e.path = []), e.path.unshift(i), e)))
      }
      void 0 === e.value ? i in n && (t.value[i] = void 0) : (t.value[i] = e.value)
    }
    let re = nI('$ZodObject', (e, t) => {
      let i
      n4.init(e, t)
      let n = Object.getOwnPropertyDescriptor(t, 'shape')
      if (!n?.get) {
        let e = t.shape
        Object.defineProperty(t, 'shape', {
          get: () => {
            let i = { ...e }
            return (Object.defineProperty(t, 'shape', { value: i }), i)
          },
        })
      }
      let r = nC(() =>
        (function (e) {
          var t
          let i = Object.keys(e.shape)
          for (let t of i)
            if (!e.shape?.[t]?._zod?.traits?.has('$ZodType'))
              throw Error(`Invalid element at key "${t}": expected a Zod schema`)
          let n = Object.keys((t = e.shape)).filter(
            (e) => 'optional' === t[e]._zod.optin && 'optional' === t[e]._zod.optout,
          )
          return { ...e, keys: i, keySet: new Set(i), numKeys: i.length, optionalKeys: new Set(n) }
        })(t),
      )
      nB(e._zod, 'propValues', () => {
        let e = t.shape,
          i = {}
        for (let t in e) {
          let n = e[t]._zod
          if (n.values) for (let e of (i[t] ?? (i[t] = new Set()), n.values)) i[t].add(e)
        }
        return i
      })
      let s = t.catchall
      e._zod.parse = (t, n) => {
        i ?? (i = r.value)
        let o = t.value
        if (!nN(o))
          return (t.issues.push({ expected: 'object', code: 'invalid_type', input: o, inst: e }), t)
        t.value = {}
        let a = [],
          l = i.shape
        for (let e of i.keys) {
          let i = l[e],
            r = 'optional' === i._zod.optout,
            s = i._zod.run({ value: o[e], issues: [] }, n)
          s instanceof Promise ? a.push(s.then((i) => n7(i, t, e, o, r))) : n7(s, t, e, o, r)
        }
        return s
          ? (function (e, t, i, n, r, s) {
              let o = [],
                a = r.keySet,
                l = r.catchall._zod,
                u = l.def.type,
                c = 'optional' === l.optout
              for (let r in t) {
                if (a.has(r)) continue
                if ('never' === u) {
                  o.push(r)
                  continue
                }
                let s = l.run({ value: t[r], issues: [] }, n)
                s instanceof Promise ? e.push(s.then((e) => n7(e, i, r, t, c))) : n7(s, i, r, t, c)
              }
              return (o.length &&
                i.issues.push({ code: 'unrecognized_keys', keys: o, input: t, inst: s }),
              e.length)
                ? Promise.all(e).then(() => i)
                : i
            })(a, o, t, n, r.value, e)
          : a.length
            ? Promise.all(a).then(() => t)
            : t
      }
    })
    function rt(e, t) {
      return e.issues.length && void 0 === t ? { issues: [], value: void 0 } : e
    }
    let ri = nI('$ZodOptional', (e, t) => {
        ;(n4.init(e, t),
          (e._zod.optin = 'optional'),
          (e._zod.optout = 'optional'),
          nB(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, void 0]) : void 0,
          ),
          nB(e._zod, 'pattern', () => {
            var e
            let i,
              n,
              r = t.innerType._zod.pattern
            return r
              ? RegExp(
                  `^(${((i = +!!(e = r.source).startsWith('^')), (n = e.endsWith('$') ? e.length - 1 : e.length), e.slice(i, n))})?$`,
                )
              : void 0
          }),
          (e._zod.parse = (e, i) => {
            if ('optional' === t.innerType._zod.optin) {
              let n = t.innerType._zod.run(e, i)
              return n instanceof Promise ? n.then((t) => rt(t, e.value)) : rt(n, e.value)
            }
            return void 0 === e.value ? e : t.innerType._zod.run(e, i)
          }))
      }),
      rn = nI('$ZodPrefault', (e, t) => {
        ;(n4.init(e, t),
          (e._zod.optin = 'optional'),
          nB(e._zod, 'values', () => t.innerType._zod.values),
          (e._zod.parse = (e, i) => (
            'backward' === i.direction || (void 0 === e.value && (e.value = t.defaultValue)),
            t.innerType._zod.run(e, i)
          )))
      })
    ;(Symbol('ZodOutput'), Symbol('ZodInput'))
    ;(h = globalThis).__zod_globalRegistry ??
      (h.__zod_globalRegistry = new (class e {
        constructor() {
          ;((this._map = new WeakMap()), (this._idmap = new Map()))
        }
        add(e, ...t) {
          let i = t[0]
          return (
            this._map.set(e, i),
            i && 'object' == typeof i && 'id' in i && this._idmap.set(i.id, e),
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
            let i = { ...(this.get(t) ?? {}) }
            delete i.id
            let n = { ...i, ...this._map.get(e) }
            return Object.keys(n).length ? n : void 0
          }
          return this._map.get(e)
        }
        has(e) {
          return this._map.has(e)
        }
      })())
    let rr = nI('ZodMiniType', (e, t) => {
        if (!e._zod) throw Error('Uninitialized schema in ZodMiniType.')
        ;(n4.init(e, t),
          (e.def = t),
          (e.type = t.type),
          (e.parse = (t, i) => nX(e, t, i, { callee: e.parse })),
          (e.safeParse = (t, i) => n0(e, t, i)),
          (e.parseAsync = async (t, i) => nY(e, t, i, { callee: e.parseAsync })),
          (e.safeParseAsync = async (t, i) => n1(e, t, i)),
          (e.check = (...i) =>
            e.clone(
              {
                ...t,
                checks: [
                  ...(t.checks ?? []),
                  ...i.map((e) =>
                    'function' == typeof e
                      ? { _zod: { check: e, def: { check: 'custom' }, onattach: [] } }
                      : e,
                  ),
                ],
              },
              { parent: !0 },
            )),
          (e.with = e.check),
          (e.clone = (t, i) => nD(e, t, i)),
          (e.brand = () => e),
          (e.register = (t, i) => (t.add(e, i), e)),
          (e.apply = (t) => t(e)))
      }),
      rs = nI('ZodMiniString', (e, t) => {
        ;(n8.init(e, t), rr.init(e, t))
      })
    function ro(e) {
      return new rs({ type: 'string', ...nL(e) })
    }
    let ra = nI('ZodMiniNumber', (e, t) => {
      ;(n5.init(e, t), rr.init(e, t))
    })
    function rl(e) {
      return new ra({ type: 'number', checks: [], ...nL(e) })
    }
    let ru = nI('ZodMiniBoolean', (e, t) => {
        ;(n9.init(e, t), rr.init(e, t))
      }),
      rc = nI('ZodMiniObject', (e, t) => {
        ;(re.init(e, t), rr.init(e, t), nB(e, 'shape', () => t.shape))
      })
    function rd(e, t) {
      if (!nV(t)) throw Error('Invalid input to extend: expected a plain object')
      let i = e._zod.def.checks
      if (i && i.length > 0) {
        let i = e._zod.def.shape
        for (let e in t)
          if (void 0 !== Object.getOwnPropertyDescriptor(i, e))
            throw Error(
              'Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.',
            )
      }
      let n = nU(e._zod.def, {
        get shape() {
          let i = { ...e._zod.def.shape, ...t }
          return (nq(this, 'shape', i), i)
        },
      })
      return nD(e, n)
    }
    let rp = nI('ZodMiniOptional', (e, t) => {
      ;(ri.init(e, t), rr.init(e, t))
    })
    function rf(e) {
      return new rp({ type: 'optional', innerType: e })
    }
    let rh = nI('ZodMiniPrefault', (e, t) => {
        ;(rn.init(e, t), rr.init(e, t))
      }),
      rv = new rc({
        type: 'object',
        shape:
          {
            campaign: rf(iI),
            locale: rf(ro()),
            location: rf(iR),
            page: rf(iM),
            screen: rf(iq),
            userAgent: rf(ro()),
          } ?? {},
        ...nL(void 0),
      }),
      ry = rd(rv, { componentId: ro(), experienceId: rf(ro()), variantIndex: rf(rl()) }),
      rg = rd(ry, {
        sticky: rf(new ru({ type: 'boolean', ...nL(void 0) })),
        viewId: ro(),
        viewDurationMs: rl(),
      }),
      rm = rd(ry, { viewId: rf(ro()), viewDurationMs: rf(rl()) }),
      rb = rd(ry, { hoverId: ro(), hoverDurationMs: rl() }),
      rw = rd(rv, { traits: rf(iU), userId: ro() }),
      r_ = rd(rv, {
        properties: rf(
          (function (e) {
            var t = void 0
            let i = e._zod.def.checks
            if (i && i.length > 0)
              throw Error('.partial() cannot be used on object schemas containing refinements')
            let n = nU(e._zod.def, {
              get shape() {
                let i = e._zod.def.shape,
                  n = { ...i }
                if (t)
                  for (let e in t) {
                    if (!(e in i)) throw Error(`Unrecognized key: "${e}"`)
                    t[e] && (n[e] = rp ? new rp({ type: 'optional', innerType: i[e] }) : i[e])
                  }
                else
                  for (let e in i) n[e] = rp ? new rp({ type: 'optional', innerType: i[e] }) : i[e]
                return (nq(this, 'shape', n), n)
              },
              checks: [],
            })
            return nD(e, n)
          })(iM),
        ),
      }),
      rz = rd(rv, { name: ro(), properties: iB }),
      rO = rd(rv, {
        event: ro(),
        properties: rf(
          ((p = {}),
          new rh({
            type: 'prefault',
            innerType: iB,
            get defaultValue() {
              return 'function' == typeof p ? p() : nV(p) ? { ...p } : Array.isArray(p) ? [...p] : p
            },
          })),
        ),
      }),
      rS = { path: '', query: {}, referrer: '', search: '', title: '', url: '' },
      rE = class {
        app
        channel
        library
        getLocale
        getPageProperties
        getUserAgent
        constructor(e) {
          const {
            app: t,
            channel: i,
            library: n,
            getLocale: r,
            getPageProperties: s,
            getUserAgent: o,
          } = e
          ;((this.app = t),
            (this.channel = i),
            (this.library = n),
            (this.getLocale = r ?? (() => 'en-US')),
            (this.getPageProperties = s ?? (() => rS)),
            (this.getUserAgent = o ?? (() => void 0)))
        }
        buildUniversalEventProperties({
          campaign: e = {},
          locale: t,
          location: i,
          page: n,
          screen: r,
          userAgent: s,
        }) {
          let o = new Date().toISOString()
          return {
            channel: this.channel,
            context: {
              app: this.app,
              campaign: e,
              gdpr: { isConsentGiven: !0 },
              library: this.library,
              locale: t ?? this.getLocale() ?? 'en-US',
              location: i,
              page: n ?? this.getPageProperties(),
              screen: r,
              userAgent: s ?? this.getUserAgent(),
            },
            messageId: crypto.randomUUID(),
            originalTimestamp: o,
            sentAt: o,
            timestamp: o,
          }
        }
        buildEntryInteractionBase(e, t, i, n) {
          return {
            ...this.buildUniversalEventProperties(e),
            componentType: 'Entry',
            componentId: t,
            experienceId: i,
            variantIndex: n ?? 0,
          }
        }
        buildView(e) {
          let {
            componentId: t,
            viewId: i,
            experienceId: n,
            variantIndex: r,
            viewDurationMs: s,
            ...o
          } = nu(rg, e)
          return {
            ...this.buildEntryInteractionBase(o, t, n, r),
            type: 'component',
            viewId: i,
            viewDurationMs: s,
          }
        }
        buildClick(e) {
          let { componentId: t, experienceId: i, variantIndex: n, ...r } = nu(ry, e)
          return { ...this.buildEntryInteractionBase(r, t, i, n), type: 'component_click' }
        }
        buildHover(e) {
          let {
            hoverId: t,
            componentId: i,
            experienceId: n,
            hoverDurationMs: r,
            variantIndex: s,
            ...o
          } = nu(rb, e)
          return {
            ...this.buildEntryInteractionBase(o, i, n, s),
            type: 'component_hover',
            hoverId: t,
            hoverDurationMs: r,
          }
        }
        buildFlagView(e) {
          let {
            componentId: t,
            experienceId: i,
            variantIndex: n,
            viewId: r,
            viewDurationMs: s,
            ...o
          } = nu(rm, e)
          return {
            ...this.buildEntryInteractionBase(o, t, i, n),
            ...(void 0 === s ? {} : { viewDurationMs: s }),
            ...(void 0 === r ? {} : { viewId: r }),
            type: 'component',
            componentType: 'Variable',
          }
        }
        buildIdentify(e) {
          let { traits: t = {}, userId: i, ...n } = nu(rw, e)
          return {
            ...this.buildUniversalEventProperties(n),
            type: 'identify',
            traits: t,
            userId: i,
          }
        }
        buildPageView(e = {}) {
          let { properties: t = {}, ...i } = nu(r_, e),
            n = this.getPageProperties(),
            r = (function e(t, i) {
              let n = Object.keys(i)
              for (let r = 0; r < n.length; r++) {
                let s = n[r]
                if ('__proto__' === s) continue
                let o = i[s],
                  a = t[s]
                nj(o) && nj(a)
                  ? (t[s] = e(a, o))
                  : Array.isArray(o)
                    ? (t[s] = e([], o))
                    : n$(o)
                      ? (t[s] = e({}, o))
                      : (void 0 === a || void 0 !== o) && (t[s] = o)
              }
              return t
            })({ ...n, title: n.title ?? rS.title }, t),
            {
              context: { screen: s, ...o },
              ...a
            } = this.buildUniversalEventProperties(i),
            l = nu(iQ, o)
          return { ...a, context: l, type: 'page', properties: r }
        }
        buildScreenView(e) {
          let { name: t, properties: i, ...n } = nu(rz, e),
            {
              context: { page: r, ...s },
              ...o
            } = this.buildUniversalEventProperties(n),
            a = nu(iH, { ...s, screen: s.screen ?? { name: t } })
          return { ...o, context: a, type: 'screen', name: t, properties: { name: t, ...i } }
        }
        buildTrack(e) {
          let { event: t, properties: i = {}, ...n } = nu(rO, e)
          return {
            ...this.buildUniversalEventProperties(n),
            type: 'track',
            event: t,
            properties: i,
          }
        }
      }
    class rk {
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
          i = e
        for (let e of t) i = await e(ep(i))
        return i
      }
    }
    let rx = {
        resolve: (e) =>
          e
            ? e.reduce((e, { key: t, value: i }) => {
                let n =
                  'object' == typeof i && null !== i && 'value' in i && 'object' == typeof i.value
                    ? i.value
                    : i
                return ((e[t] = n), e)
              }, {})
            : {},
      },
      rP = nd('Optimization'),
      r$ = 'Could not resolve Merge Tag value:',
      rj = (e, t) => {
        if (!e || 'object' != typeof e) return
        if (!t) return e
        let i = e
        for (let e of t.split('.').filter(Boolean)) {
          if (!i || ('object' != typeof i && 'function' != typeof i)) return
          i = Reflect.get(i, e)
        }
        return i
      },
      rI = {
        normalizeSelectors: (e) =>
          e
            .split('_')
            .map((e, t, i) =>
              [i.slice(0, t).join('.'), i.slice(t).join('_')].filter((e) => '' !== e).join('.'),
            ),
        getValueFromProfile(e, t) {
          let i = rI.normalizeSelectors(e).find((e) => rj(t, e))
          if (!i) return
          let n = rj(t, i)
          if (n && ('string' == typeof n || 'number' == typeof n || 'boolean' == typeof n))
            return `${n}`
        },
        resolve(e, t) {
          if (!iy.safeParse(e).success)
            return void rP.warn(`${r$} supplied entry is not a Merge Tag entry`)
          let {
            fields: { nt_fallback: i },
          } = e
          return i5.safeParse(t).success
            ? (rI.getValueFromProfile(e.fields.nt_mergetag_id, t) ?? i)
            : (rP.warn(`${r$} no valid profile`), i)
        },
      },
      rT = nd('Optimization'),
      rA = 'Could not resolve optimized entry variant:',
      rF = {
        getOptimizationEntry({ optimizedEntry: e, selectedOptimizations: t }, i = !1) {
          if (i || (t.length && i$(e)))
            return e.fields.nt_experiences
              .filter((e) => iP(e))
              .find((e) => t.some(({ experienceId: t }) => t === e.fields.nt_experience_id))
        },
        getSelectedOptimization({ optimizationEntry: e, selectedOptimizations: t }, i = !1) {
          if (i || (t.length && iP(e)))
            return t.find(({ experienceId: t }) => t === e.fields.nt_experience_id)
        },
        getSelectedVariant(
          { optimizedEntry: e, optimizationEntry: t, selectedVariantIndex: i },
          n = !1,
        ) {
          var r
          if (!n && (!i$(e) || !iP(t))) return
          let s = ((r = t.fields.nt_config),
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
          if (s?.length) return s.at(i - 1)
        },
        getSelectedVariantEntry({ optimizationEntry: e, selectedVariant: t }, i = !1) {
          if (!i && (!iP(e) || !ig.safeParse(t).success)) return
          let n = e.fields.nt_variants?.find((e) => e.sys.id === t.id)
          return ip.safeParse(n).success ? n : void 0
        },
        resolve: function (e, t) {
          if ((rT.debug(`Resolving optimized entry for baseline entry ${e.sys.id}`), !t?.length))
            return (
              rT.warn(`${rA} no selectedOptimizations exist for the current profile`),
              { entry: e }
            )
          if (!i$(e)) return (rT.warn(`${rA} entry ${e.sys.id} is not optimized`), { entry: e })
          let i = rF.getOptimizationEntry({ optimizedEntry: e, selectedOptimizations: t }, !0)
          if (!i)
            return (
              rT.warn(`${rA} could not find an optimization entry for ${e.sys.id}`),
              { entry: e }
            )
          let n = rF.getSelectedOptimization(
              { optimizationEntry: i, selectedOptimizations: t },
              !0,
            ),
            r = n?.variantIndex ?? 0
          if (0 === r)
            return (
              rT.debug(`Resolved optimization entry for entry ${e.sys.id} is baseline`),
              { entry: e }
            )
          let s = rF.getSelectedVariant(
            { optimizedEntry: e, optimizationEntry: i, selectedVariantIndex: r },
            !0,
          )
          if (!s)
            return (
              rT.warn(`${rA} could not find a valid replacement variant entry for ${e.sys.id}`),
              { entry: e }
            )
          let o = rF.getSelectedVariantEntry({ optimizationEntry: i, selectedVariant: s }, !0)
          return o
            ? (rT.debug(`Entry ${e.sys.id} has been resolved to variant entry ${o.sys.id}`),
              { entry: o, selectedOptimization: n })
            : (rT.warn(`${rA} could not find a valid replacement variant entry for ${e.sys.id}`),
              { entry: e })
        },
      }
    class rR {
      api
      eventBuilder
      config
      flagsResolver = rx
      mergeTagValueResolver = rI
      optimizedEntryResolver = rF
      interceptors = { event: new rk(), state: new rk() }
      constructor(e, t = {}) {
        this.config = e
        const { eventBuilder: i, logLevel: n, environment: r, clientId: s, fetchOptions: o } = e
        nc.addSink(new nv(n))
        const a = {
          clientId: s,
          environment: r,
          fetchOptions: o,
          experience: t.experience,
          insights: t.insights,
        }
        ;((this.api = new nP(a)),
          (this.eventBuilder = new rE(
            i ?? {
              channel: 'server',
              library: { name: '@contentful/optimization-ios-bridge', version: '0.0.0' },
            },
          )))
      }
      getFlag(e, t) {
        return this.flagsResolver.resolve(t)[e]
      }
      resolveOptimizedEntry(e, t) {
        return this.optimizedEntryResolver.resolve(e, t)
      }
      getMergeTagValue(e, t) {
        return this.mergeTagValueResolver.resolve(e, t)
      }
    }
    let rC = rR
    function rM() {}
    function rB(e, t) {
      return (function e(t, i, n, r, s, o, a) {
        let l = a(t, i, n, r, s, o)
        if (void 0 !== l) return l
        if (typeof t == typeof i)
          switch (typeof t) {
            case 'bigint':
            case 'string':
            case 'boolean':
            case 'symbol':
            case 'undefined':
            case 'function':
              return t === i
            case 'number':
              return t === i || Object.is(t, i)
          }
        return (function t(i, n, r, s) {
          if (Object.is(i, n)) return !0
          let o = Z(i),
            a = Z(n)
          if ((o === Q && (o = Y), a === Q && (a = Y), o !== a)) return !1
          switch (o) {
            case V:
              return i.toString() === n.toString()
            case D: {
              let e = i.valueOf(),
                t = n.valueOf()
              return e === t || (Number.isNaN(e) && Number.isNaN(t))
            }
            case L:
            case H:
            case J:
              return Object.is(i.valueOf(), n.valueOf())
            case N:
              return i.source === n.source && i.flags === n.flags
            case '[object Function]':
              return i === n
          }
          let l = (r = r ?? new Map()).get(i),
            u = r.get(n)
          if (null != l && null != u) return l === n
          ;(r.set(i, n), r.set(n, i))
          try {
            switch (o) {
              case K:
                if (i.size !== n.size) return !1
                for (let [t, o] of i.entries())
                  if (!n.has(t) || !e(o, n.get(t), t, i, n, r, s)) return !1
                return !0
              case W: {
                if (i.size !== n.size) return !1
                let t = Array.from(i.values()),
                  o = Array.from(n.values())
                for (let a = 0; a < t.length; a++) {
                  let l = t[a],
                    u = o.findIndex((t) => e(l, t, void 0, i, n, r, s))
                  if (-1 === u) return !1
                  o.splice(u, 1)
                }
                return !0
              }
              case G:
              case et:
              case ei:
              case en:
              case er:
              case '[object BigUint64Array]':
              case es:
              case eo:
              case ea:
              case '[object BigInt64Array]':
              case el:
              case eu:
                if (
                  ('u' > typeof Buffer && Buffer.isBuffer(i) !== Buffer.isBuffer(n)) ||
                  i.length !== n.length
                )
                  return !1
                for (let t = 0; t < i.length; t++) if (!e(i[t], n[t], t, i, n, r, s)) return !1
                return !0
              case X:
                if (i.byteLength !== n.byteLength) return !1
                return t(new Uint8Array(i), new Uint8Array(n), r, s)
              case ee:
                if (i.byteLength !== n.byteLength || i.byteOffset !== n.byteOffset) return !1
                return t(new Uint8Array(i), new Uint8Array(n), r, s)
              case '[object Error]':
                return i.name === n.name && i.message === n.message
              case Y: {
                if (!(t(i.constructor, n.constructor, r, s) || (n$(i) && n$(n)))) return !1
                let o = [...Object.keys(i), ...U(i)],
                  a = [...Object.keys(n), ...U(n)]
                if (o.length !== a.length) return !1
                for (let t = 0; t < o.length; t++) {
                  let a = o[t],
                    l = i[a]
                  if (!Object.hasOwn(n, a)) return !1
                  let u = n[a]
                  if (!e(l, u, a, i, n, r, s)) return !1
                }
                return !0
              }
              default:
                return !1
            }
          } finally {
            ;(r.delete(i), r.delete(n))
          }
        })(t, i, o, a)
      })(e, t, void 0, void 0, void 0, void 0, rM)
    }
    let rq = nd('CoreStateful'),
      rU = {
        trackView: 'component',
        trackFlagView: 'component',
        trackClick: 'component_click',
        trackHover: 'component_hover',
      }
    class rZ extends rC {
      flagObservables = new Map()
      getFlag(e, t = eh.value) {
        let i = super.getFlag(e, t),
          n = this.buildFlagViewBuilderArgs(e, t)
        return (
          this.trackFlagView(n).catch((t) => {
            nc.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
          }),
          i
        )
      }
      resolveOptimizedEntry(e, t = e_.value) {
        return super.resolveOptimizedEntry(e, t)
      }
      getMergeTagValue(e, t = eO.value) {
        return super.getMergeTagValue(e, t)
      }
      async identify(e) {
        let { profile: t, ...i } = e
        return await this.sendExperienceEvent(
          'identify',
          [e],
          this.eventBuilder.buildIdentify(i),
          t,
        )
      }
      async page(e = {}) {
        let { profile: t, ...i } = e
        return await this.sendExperienceEvent('page', [e], this.eventBuilder.buildPageView(i), t)
      }
      async screen(e) {
        let { profile: t, ...i } = e
        return await this.sendExperienceEvent(
          'screen',
          [e],
          this.eventBuilder.buildScreenView(i),
          t,
        )
      }
      async track(e) {
        let { profile: t, ...i } = e
        return await this.sendExperienceEvent('track', [e], this.eventBuilder.buildTrack(i), t)
      }
      async trackView(e) {
        let t,
          { profile: i, ...n } = e
        return (
          e.sticky &&
            (t = await this.sendExperienceEvent(
              'trackView',
              [e],
              this.eventBuilder.buildView(n),
              i,
            )),
          await this.sendInsightsEvent('trackView', [e], this.eventBuilder.buildView(n), i),
          t
        )
      }
      async trackClick(e) {
        await this.sendInsightsEvent('trackClick', [e], this.eventBuilder.buildClick(e))
      }
      async trackHover(e) {
        await this.sendInsightsEvent('trackHover', [e], this.eventBuilder.buildHover(e))
      }
      async trackFlagView(e) {
        await this.sendInsightsEvent('trackFlagView', [e], this.eventBuilder.buildFlagView(e))
      }
      hasConsent(e) {
        let { [e]: t } = rU,
          i =
            void 0 !== t
              ? this.allowedEventTypes.includes(t)
              : this.allowedEventTypes.some((t) => t === e)
        return !!ey.value || i
      }
      onBlockedByConsent(e, t) {
        ;(rq.warn(`Event "${e}" was blocked due to lack of consent; payload: ${JSON.stringify(t)}`),
          this.reportBlockedEvent('consent', e, t))
      }
      async sendExperienceEvent(e, t, i, n) {
        return this.hasConsent(e)
          ? await this.experienceQueue.send(i)
          : void this.onBlockedByConsent(e, t)
      }
      async sendInsightsEvent(e, t, i, n) {
        this.hasConsent(e) ? await this.insightsQueue.send(i) : this.onBlockedByConsent(e, t)
      }
      buildFlagViewBuilderArgs(e, t = eh.value) {
        let i = t?.find((t) => t.key === e)
        return {
          componentId: e,
          experienceId: i?.meta.experienceId,
          variantIndex: i?.meta.variantIndex,
        }
      }
      getFlagObservable(e) {
        var t
        let i,
          n = this.flagObservables.get(e)
        if (n) return n
        let r = this.trackFlagView.bind(this),
          s = this.buildFlagViewBuilderArgs.bind(this),
          o =
            ((t = eE.computed(() => super.getFlag(e, eh.value))),
            (i = ef(t)),
            {
              get current() {
                return i.current
              },
              subscribe(e) {
                let t = !1,
                  n = ep(i.current)
                return i.subscribe((i) => {
                  ;(t && rB(n, i)) || ((t = !0), (n = ep(i)), e(i))
                })
              },
              subscribeOnce: (e) => i.subscribeOnce(e),
            }),
          a = {
            get current() {
              let { current: t } = o
              return (
                r(s(e, eh.value)).catch((t) => {
                  nc.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                t
              )
            },
            subscribe: (t) =>
              o.subscribe((i) => {
                ;(r(s(e, eh.value)).catch((t) => {
                  nc.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                  t(i))
              }),
            subscribeOnce: (t) =>
              o.subscribeOnce((i) => {
                ;(r(s(e, eh.value)).catch((t) => {
                  nc.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                  t(i))
              }),
          }
        return (this.flagObservables.set(e, a), a)
      }
      reportBlockedEvent(e, t, i) {
        let n = { reason: e, method: t, args: i }
        try {
          this.onEventBlocked?.(n)
        } catch (e) {
          rq.warn(`onEventBlocked callback failed for method "${t}"`, e)
        }
        ev.value = n
      }
    }
    let rN = rZ,
      rV = (e, t) => (!Number.isFinite(e) || void 0 === e || e < 1 ? t : Math.floor(e)),
      rD = {
        flushIntervalMs: 3e4,
        baseBackoffMs: 500,
        maxBackoffMs: 3e4,
        jitterRatio: 0.2,
        maxConsecutiveFailures: 8,
        circuitOpenMs: 12e4,
      },
      rL = '__ctfl_optimization_stateful_runtime_lock__',
      rQ = () => {
        let e = globalThis
        return ((e[rL] ??= { owner: void 0 }), e[rL])
      },
      rJ = (e) => {
        let t = rQ()
        t.owner === e && (t.owner = void 0)
      }
    class rH {
      circuitOpenUntil = 0
      flushFailureCount = 0
      flushInFlight = !1
      nextFlushAllowedAt = 0
      onCallbackError
      onRetry
      policy
      retryTimer
      constructor(e) {
        const { onCallbackError: t, onRetry: i, policy: n } = e
        ;((this.policy = n), (this.onRetry = i), (this.onCallbackError = t))
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
        let { force: t, isOnline: i } = e
        if (this.flushInFlight) return !0
        if (t) return !1
        if (!i) return !0
        let n = Date.now()
        return !!(this.nextFlushAllowedAt > n) || !!(this.circuitOpenUntil > n)
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
        let { queuedBatches: t, queuedEvents: i } = e
        this.flushFailureCount += 1
        let n = ((e) => {
            let {
                consecutiveFailures: t,
                policy: { baseBackoffMs: i, jitterRatio: n, maxBackoffMs: r },
              } = e,
              s = Math.min(r, i * 2 ** Math.max(0, t - 1)),
              o = s * n * Math.random()
            return Math.round(s + o)
          })({ consecutiveFailures: this.flushFailureCount, policy: this.policy }),
          r = Date.now(),
          s = {
            consecutiveFailures: this.flushFailureCount,
            queuedBatches: t,
            queuedEvents: i,
            retryDelayMs: n,
          }
        this.safeInvoke('onFlushFailure', s)
        let {
          circuitOpenUntil: o,
          nextFlushAllowedAt: a,
          openedCircuit: l,
          retryDelayMs: u,
        } = ((e) => {
          let {
            consecutiveFailures: t,
            failureTimestamp: i,
            retryDelayMs: n,
            policy: { maxConsecutiveFailures: r, circuitOpenMs: s },
          } = e
          if (t < r)
            return {
              openedCircuit: !1,
              retryDelayMs: n,
              nextFlushAllowedAt: i + n,
              circuitOpenUntil: 0,
            }
          let o = i + s
          return { openedCircuit: !0, retryDelayMs: s, nextFlushAllowedAt: o, circuitOpenUntil: o }
        })({
          consecutiveFailures: this.flushFailureCount,
          failureTimestamp: r,
          retryDelayMs: n,
          policy: this.policy,
        })
        ;((this.nextFlushAllowedAt = a),
          l &&
            ((this.circuitOpenUntil = o),
            this.safeInvoke('onCircuitOpen', { ...s, retryDelayMs: u })),
          this.scheduleRetry(u))
      }
      scheduleRetry(e) {
        ;(this.clearScheduledRetry(),
          (this.retryTimer = setTimeout(() => {
            ;((this.retryTimer = void 0), this.onRetry())
          }, e)))
      }
      safeInvoke(...e) {
        let [t, i] = e
        try {
          if ('onFlushRecovered' === t) return void this.policy.onFlushRecovered?.(i)
          if ('onCircuitOpen' === t) return void this.policy.onCircuitOpen?.(i)
          this.policy.onFlushFailure?.(i)
        } catch (e) {
          this.onCallbackError?.(t, e)
        }
      }
    }
    let rK = nd('CoreStateful')
    class rW {
      experienceApi
      eventInterceptors
      flushRuntime
      getAnonymousId
      offlineMaxEvents
      onOfflineDrop
      queuedExperienceEvents = new Set()
      stateInterceptors
      constructor(e) {
        const {
          experienceApi: t,
          eventInterceptors: i,
          flushPolicy: n,
          getAnonymousId: r,
          offlineMaxEvents: s,
          onOfflineDrop: o,
          stateInterceptors: a,
        } = e
        ;((this.experienceApi = t),
          (this.eventInterceptors = i),
          (this.getAnonymousId = r),
          (this.offlineMaxEvents = s),
          (this.onOfflineDrop = o),
          (this.stateInterceptors = a),
          (this.flushRuntime = new rH({
            policy: n,
            onRetry: () => {
              this.flush()
            },
            onCallbackError: (e, t) => {
              rK.warn(`Experience flush policy callback "${e}" failed`, t)
            },
          })))
      }
      clearScheduledRetry() {
        this.flushRuntime.clearScheduledRetry()
      }
      async send(e) {
        let t = nu(i1, await this.eventInterceptors.run(e))
        if (((eg.value = t), em.value)) return await this.upsertProfile([t])
        ;(rK.debug(`Queueing ${t.type} event`, t), this.enqueueEvent(t))
      }
      async flush(e = {}) {
        let { force: t = !1 } = e
        if (this.flushRuntime.shouldSkip({ force: t, isOnline: !!em.value })) return
        if (0 === this.queuedExperienceEvents.size)
          return void this.flushRuntime.clearScheduledRetry()
        rK.debug('Flushing offline Experience event queue')
        let i = Array.from(this.queuedExperienceEvents)
        this.flushRuntime.markFlushStarted()
        try {
          ;(await this.tryUpsertQueuedEvents(i))
            ? (i.forEach((e) => {
                this.queuedExperienceEvents.delete(e)
              }),
              this.flushRuntime.handleFlushSuccess())
            : this.flushRuntime.handleFlushFailure({
                queuedBatches: +(this.queuedExperienceEvents.size > 0),
                queuedEvents: this.queuedExperienceEvents.size,
              })
        } finally {
          this.flushRuntime.markFlushFinished()
        }
      }
      enqueueEvent(e) {
        let t = []
        if (this.queuedExperienceEvents.size >= this.offlineMaxEvents) {
          let e = this.queuedExperienceEvents.size - this.offlineMaxEvents + 1
          ;(t = this.dropOldestEvents(e)).length > 0 &&
            rK.warn(
              `Dropped ${t.length} oldest offline event(s) due to queue limit (${this.offlineMaxEvents})`,
            )
        }
        ;(this.queuedExperienceEvents.add(e),
          t.length > 0 &&
            this.invokeOfflineDropCallback({
              droppedCount: t.length,
              droppedEvents: t,
              maxEvents: this.offlineMaxEvents,
              queuedEvents: this.queuedExperienceEvents.size,
            }))
      }
      dropOldestEvents(e) {
        let t = []
        for (let i = 0; i < e; i += 1) {
          let e = this.queuedExperienceEvents.values().next()
          if (e.done) break
          ;(this.queuedExperienceEvents.delete(e.value), t.push(e.value))
        }
        return t
      }
      invokeOfflineDropCallback(e) {
        try {
          this.onOfflineDrop?.(e)
        } catch (e) {
          rK.warn('Offline queue drop callback failed', e)
        }
      }
      async tryUpsertQueuedEvents(e) {
        try {
          return (await this.upsertProfile(e), !0)
        } catch (e) {
          return (rK.warn('Experience queue flush request threw an error', e), !1)
        }
      }
      async upsertProfile(e) {
        let t = this.getAnonymousId()
        t && rK.debug(`Anonymous ID found: ${t}`)
        let i = await this.experienceApi.upsertProfile({ profileId: t ?? eO.value?.id, events: e })
        return (await this.updateOutputSignals(i), i)
      }
      async updateOutputSignals(e) {
        let {
          changes: t,
          profile: i,
          selectedOptimizations: n,
        } = await this.stateInterceptors.run(e)
        b(() => {
          ;(rB(eh.value, t) || (eh.value = t),
            rB(eO.value, i) || (eO.value = i),
            rB(e_.value, n) || (e_.value = n))
        })
      }
    }
    let rG = nd('CoreStateful')
    class rX {
      eventInterceptors
      flushIntervalMs
      flushRuntime
      insightsApi
      queuedInsightsByProfile = new Map()
      insightsPeriodicFlushTimer
      constructor(e) {
        const { eventInterceptors: t, flushPolicy: i, insightsApi: n } = e,
          { flushIntervalMs: r } = i
        ;((this.eventInterceptors = t),
          (this.flushIntervalMs = r),
          (this.insightsApi = n),
          (this.flushRuntime = new rH({
            policy: i,
            onRetry: () => {
              this.flush()
            },
            onCallbackError: (e, t) => {
              rG.warn(`Insights flush policy callback "${e}" failed`, t)
            },
          })))
      }
      clearScheduledRetry() {
        this.flushRuntime.clearScheduledRetry()
      }
      clearPeriodicFlushTimer() {
        void 0 !== this.insightsPeriodicFlushTimer &&
          (clearInterval(this.insightsPeriodicFlushTimer),
          (this.insightsPeriodicFlushTimer = void 0))
      }
      async send(e) {
        let { value: t } = eO
        if (!t) return void rG.warn('Attempting to emit an event without an Optimization profile')
        let i = nu(no, await this.eventInterceptors.run(e))
        rG.debug(`Queueing ${i.type} event for profile ${t.id}`, i)
        let n = this.queuedInsightsByProfile.get(t.id)
        ;((eg.value = i),
          n
            ? ((n.profile = t), n.events.push(i))
            : this.queuedInsightsByProfile.set(t.id, { profile: t, events: [i] }),
          this.ensurePeriodicFlushTimer(),
          this.getQueuedEventCount() >= 25 && (await this.flush()),
          this.reconcilePeriodicFlushTimer())
      }
      async flush(e = {}) {
        let { force: t = !1 } = e
        if (this.flushRuntime.shouldSkip({ force: t, isOnline: !!em.value })) return
        rG.debug('Flushing insights event queue')
        let i = this.createBatches()
        if (!i.length) {
          ;(this.flushRuntime.clearScheduledRetry(), this.reconcilePeriodicFlushTimer())
          return
        }
        this.flushRuntime.markFlushStarted()
        try {
          ;(await this.trySendBatches(i))
            ? (this.queuedInsightsByProfile.clear(), this.flushRuntime.handleFlushSuccess())
            : this.flushRuntime.handleFlushFailure({
                queuedBatches: i.length,
                queuedEvents: this.getQueuedEventCount(),
              })
        } finally {
          ;(this.flushRuntime.markFlushFinished(), this.reconcilePeriodicFlushTimer())
        }
      }
      createBatches() {
        let e = []
        return (
          this.queuedInsightsByProfile.forEach(({ profile: t, events: i }) => {
            e.push({ profile: t, events: i })
          }),
          e
        )
      }
      async trySendBatches(e) {
        try {
          return await this.insightsApi.sendBatchEvents(e)
        } catch (e) {
          return (rG.warn('Insights queue flush request threw an error', e), !1)
        }
      }
      getQueuedEventCount() {
        let e = 0
        return (
          this.queuedInsightsByProfile.forEach(({ events: t }) => {
            e += t.length
          }),
          e
        )
      }
      ensurePeriodicFlushTimer() {
        void 0 !== this.insightsPeriodicFlushTimer ||
          (0 !== this.getQueuedEventCount() &&
            (this.insightsPeriodicFlushTimer = setInterval(() => {
              this.flush()
            }, this.flushIntervalMs)))
      }
      reconcilePeriodicFlushTimer() {
        this.getQueuedEventCount() > 0
          ? this.ensurePeriodicFlushTimer()
          : this.clearPeriodicFlushTimer()
      }
    }
    let rY = Symbol.for('ctfl.optimization.preview.signals'),
      r0 = Symbol.for('ctfl.optimization.preview.signalFns'),
      r1 = nd('CoreStateful'),
      r2 = ['identify', 'page', 'screen'],
      r6 = (e) => Object.values(e).some((e) => void 0 !== e),
      r3 = 0
    class r4 extends rN {
      singletonOwner
      destroyed = !1
      allowedEventTypes
      experienceQueue
      insightsQueue
      onEventBlocked
      states = {
        blockedEventStream: ef(ev),
        flag: (e) => this.getFlagObservable(e),
        consent: ef(ey),
        eventStream: ef(eg),
        canOptimize: ef(ez),
        selectedOptimizations: ef(e_),
        previewPanelAttached: ef(eb),
        previewPanelOpen: ef(ew),
        profile: ef(eO),
      }
      constructor(e) {
        ;(super(e, {
          experience: ((e) => {
            if (void 0 === e) return
            let t = {
              baseUrl: e.experienceBaseUrl,
              enabledFeatures: e.enabledFeatures,
              ip: e.ip,
              locale: e.locale,
              plainText: e.plainText,
              preflight: e.preflight,
            }
            return r6(t) ? t : void 0
          })(e.api),
          insights: ((e) => {
            if (void 0 === e) return
            let t = { baseUrl: e.insightsBaseUrl, beaconHandler: e.beaconHandler }
            return r6(t) ? t : void 0
          })(e.api),
        }),
          (this.singletonOwner = `CoreStateful#${++r3}`),
          ((e) => {
            let t = rQ()
            if (t.owner)
              throw Error(
                `Stateful Optimization SDK already initialized (${t.owner}). Only one stateful instance is supported per runtime.`,
              )
            t.owner = e
          })(this.singletonOwner))
        try {
          const {
              allowedEventTypes: t,
              defaults: i,
              getAnonymousId: n,
              onEventBlocked: r,
              queuePolicy: s,
            } = e,
            { changes: o, consent: a, selectedOptimizations: l, profile: u } = i ?? {},
            c = ((e) => ({
              flush: ((e, t = rD) => {
                var i, n
                let r = e ?? {},
                  s = rV(r.baseBackoffMs, t.baseBackoffMs),
                  o = Math.max(s, rV(r.maxBackoffMs, t.maxBackoffMs))
                return {
                  flushIntervalMs: rV(r.flushIntervalMs, t.flushIntervalMs),
                  baseBackoffMs: s,
                  maxBackoffMs: o,
                  jitterRatio:
                    ((i = r.jitterRatio),
                    (n = t.jitterRatio),
                    Number.isFinite(i) && void 0 !== i ? Math.min(1, Math.max(0, i)) : n),
                  maxConsecutiveFailures: rV(r.maxConsecutiveFailures, t.maxConsecutiveFailures),
                  circuitOpenMs: rV(r.circuitOpenMs, t.circuitOpenMs),
                  onCircuitOpen: r.onCircuitOpen,
                  onFlushFailure: r.onFlushFailure,
                  onFlushRecovered: r.onFlushRecovered,
                }
              })(e?.flush),
              offlineMaxEvents: rV(e?.offlineMaxEvents, 100),
              onOfflineDrop: e?.onOfflineDrop,
            }))(s)
          ;((this.allowedEventTypes = t ?? r2),
            (this.onEventBlocked = r),
            (this.insightsQueue = new rX({
              eventInterceptors: this.interceptors.event,
              flushPolicy: c.flush,
              insightsApi: this.api.insights,
            })),
            (this.experienceQueue = new rW({
              experienceApi: this.api.experience,
              eventInterceptors: this.interceptors.event,
              flushPolicy: c.flush,
              getAnonymousId: n ?? (() => void 0),
              offlineMaxEvents: c.offlineMaxEvents,
              onOfflineDrop: c.onOfflineDrop,
              stateInterceptors: this.interceptors.state,
            })),
            void 0 !== a && (ey.value = a),
            b(() => {
              ;(void 0 !== o && (eh.value = o),
                void 0 !== l && (e_.value = l),
                void 0 !== u && (eO.value = u))
            }),
            this.initializeEffects())
        } catch (e) {
          throw (rJ(this.singletonOwner), e)
        }
      }
      initializeEffects() {
        ;(q(() => {
          r1.debug(
            `Profile ${eO.value && `with ID ${eO.value.id}`} has been ${eO.value ? 'set' : 'cleared'}`,
          )
        }),
          q(() => {
            r1.debug(`Variants have been ${e_.value?.length ? 'populated' : 'cleared'}`)
          }),
          q(() => {
            r1.info(
              `Core ${ey.value ? 'will' : 'will not'} emit gated events due to consent (${ey.value})`,
            )
          }),
          q(() => {
            em.value &&
              (this.insightsQueue.clearScheduledRetry(),
              this.experienceQueue.clearScheduledRetry(),
              this.flushQueues({ force: !0 }))
          }))
      }
      async flushQueues(e = {}) {
        ;(await this.insightsQueue.flush(e), await this.experienceQueue.flush(e))
      }
      destroy() {
        this.destroyed ||
          ((this.destroyed = !0),
          this.insightsQueue.flush({ force: !0 }).catch((e) => {
            nc.warn('Failed to flush insights queue during destroy()', String(e))
          }),
          this.experienceQueue.flush({ force: !0 }).catch((e) => {
            nc.warn('Failed to flush Experience queue during destroy()', String(e))
          }),
          this.insightsQueue.clearPeriodicFlushTimer(),
          rJ(this.singletonOwner))
      }
      reset() {
        b(() => {
          ;((ev.value = void 0),
            (eg.value = void 0),
            (eh.value = void 0),
            (eO.value = void 0),
            (e_.value = void 0))
        })
      }
      async flush() {
        await this.flushQueues()
      }
      consent(e) {
        ey.value = e
      }
      get online() {
        return em.value ?? !1
      }
      set online(e) {
        em.value = e
      }
      registerPreviewPanel(e) {
        ;(Reflect.set(e, rY, eS), Reflect.set(e, r0, eE))
      }
    }
    function r8(e, t) {
      let i = Object.values(t)
      if (0 === i.length) return e
      let n = e.map((e) => {
        let { [e.experienceId]: i } = t
        return i ? { ...e, variantIndex: i.variantIndex } : e
      })
      for (let e of i)
        n.some((t) => t.experienceId === e.experienceId) ||
          n.push({ experienceId: e.experienceId, variantIndex: e.variantIndex, variants: {} })
      return n
    }
    let r5 = nd('PreviewOverrides'),
      r9 = { audiences: {}, selectedOptimizations: {} }
    class r7 {
      baselineSelectedOptimizations = null
      overrides = { ...r9, audiences: {}, selectedOptimizations: {} }
      interceptorId = null
      selectedOptimizations
      stateInterceptors
      onOverridesChanged
      constructor(e) {
        const { selectedOptimizations: t, stateInterceptors: i, onOverridesChanged: n } = e
        ;((this.selectedOptimizations = t),
          (this.stateInterceptors = i),
          (this.onOverridesChanged = n))
        const { value: r } = t
        ;(r &&
          ((this.baselineSelectedOptimizations = r),
          r5.debug('Captured initial signal state as baseline')),
          (this.interceptorId = e.stateInterceptors.add((e) =>
            ((this.baselineSelectedOptimizations = e.selectedOptimizations),
            0 === Object.keys(this.overrides.selectedOptimizations).length)
              ? { ...e }
              : (r5.debug('Intercepting state update to preserve overrides'),
                {
                  ...e,
                  selectedOptimizations: r8(
                    e.selectedOptimizations,
                    this.overrides.selectedOptimizations,
                  ),
                }),
          )),
          r5.info('State interceptor registered'))
      }
      activateAudience(e, t) {
        ;(r5.info('Activating audience override:', e), this.setAudienceOverride(e, !0, 1, t))
      }
      deactivateAudience(e, t) {
        ;(r5.info('Deactivating audience override:', e), this.setAudienceOverride(e, !1, 0, t))
      }
      resetAudienceOverride(e) {
        r5.info('Resetting audience override:', e)
        let { overrides: t } = this,
          { audiences: i, selectedOptimizations: n } = t,
          r = i[e]?.experienceIds ?? [],
          s = new Set(r),
          o = Object.fromEntries(Object.entries(n).filter(([e]) => !s.has(e))),
          a = Object.fromEntries(Object.entries(i).filter(([t]) => t !== e))
        ;((this.overrides = { audiences: a, selectedOptimizations: o }),
          r.length > 0 && this.syncOverridesToSignal(),
          this.notifyChanged())
      }
      setVariantOverride(e, t) {
        ;(r5.info('Setting variant override:', { experienceId: e, variantIndex: t }),
          (this.overrides = {
            ...this.overrides,
            selectedOptimizations: {
              ...this.overrides.selectedOptimizations,
              [e]: { experienceId: e, variantIndex: t },
            },
          }),
          this.syncOverridesToSignal(),
          this.notifyChanged())
      }
      resetOptimizationOverride(e) {
        r5.info('Resetting optimization override:', e)
        let { selectedOptimizations: t } = { ...this.overrides },
          i = Object.fromEntries(Object.entries(t).filter(([t]) => t !== e))
        ;((this.overrides = { ...this.overrides, selectedOptimizations: i }),
          this.syncOverridesToSignal(),
          this.notifyChanged())
      }
      resetAll() {
        ;(r5.info('Resetting all overrides to baseline'),
          (this.overrides = { audiences: {}, selectedOptimizations: {} }),
          this.baselineSelectedOptimizations &&
            ((this.selectedOptimizations.value = this.baselineSelectedOptimizations),
            r5.debug('Restored signal to baseline')),
          this.notifyChanged())
      }
      getOverrides() {
        return this.overrides
      }
      getBaselineSelectedOptimizations() {
        return this.baselineSelectedOptimizations
      }
      destroy() {
        ;(null !== this.interceptorId &&
          (this.stateInterceptors.remove(this.interceptorId),
          r5.info('State interceptor removed'),
          (this.interceptorId = null)),
          (this.overrides = { audiences: {}, selectedOptimizations: {} }),
          (this.baselineSelectedOptimizations = null))
      }
      syncOverridesToSignal() {
        ;((this.selectedOptimizations.value = r8(
          this.baselineSelectedOptimizations ?? [],
          this.overrides.selectedOptimizations,
        )),
          r5.debug('Synced overrides to signal'))
      }
      setAudienceOverride(e, t, i, n) {
        let r = { ...this.overrides.selectedOptimizations }
        for (let e of n) r[e] = { experienceId: e, variantIndex: i }
        ;((this.overrides = {
          audiences: {
            ...this.overrides.audiences,
            [e]: { audienceId: e, isActive: t, source: 'manual', experienceIds: n },
          },
          selectedOptimizations: r,
        }),
          n.length > 0 && this.syncOverridesToSignal(),
          this.notifyChanged())
      }
      notifyChanged() {
        this.onOverridesChanged?.(this.overrides)
      }
    }
    let se = null,
      st = null,
      si = null,
      sn = null,
      sr = {
        initialize(e) {
          ;(se && sr.destroy(),
            (se = new r4({
              clientId: e.clientId,
              environment: e.environment,
              api: { experienceBaseUrl: e.experienceBaseUrl, insightsBaseUrl: e.insightsBaseUrl },
            })),
            e.defaults &&
              (void 0 !== e.defaults.consent && se.consent(e.defaults.consent),
              void 0 !== e.defaults.profile && (eS.profile.value = e.defaults.profile),
              void 0 !== e.defaults.changes && (eS.changes.value = e.defaults.changes),
              void 0 !== e.defaults.optimizations &&
                (eS.selectedOptimizations.value = e.defaults.optimizations)),
            se.consent(!0),
            (sn = new r7({
              selectedOptimizations: eS.selectedOptimizations,
              stateInterceptors: se.interceptors.state,
            })))
          let t = globalThis
          ;((st = q(() => {
            let e = {
              profile: eS.profile.value ?? null,
              consent: eS.consent.value,
              canPersonalize: eS.canOptimize.value,
              changes: eS.changes.value ?? null,
              selectedPersonalizations: eS.selectedOptimizations.value ?? null,
            }
            'function' == typeof t.__nativeOnStateChange &&
              t.__nativeOnStateChange(JSON.stringify(e))
          })),
            (si = q(() => {
              let e = eS.event.value
              e &&
                'function' == typeof t.__nativeOnEventEmitted &&
                t.__nativeOnEventEmitted(JSON.stringify(e))
            })))
        },
        identify(e, t, i) {
          se
            ? se
                .identify(e)
                .then((e) => {
                  t(JSON.stringify(e ?? null))
                })
                .catch((e) => {
                  i(e instanceof Error ? e.message : String(e))
                })
            : i('SDK not initialized. Call initialize() first.')
        },
        page(e, t, i) {
          se
            ? se
                .page(e)
                .then((e) => {
                  t(JSON.stringify(e ?? null))
                })
                .catch((e) => {
                  i(e instanceof Error ? e.message : String(e))
                })
            : i('SDK not initialized. Call initialize() first.')
        },
        screen(e, t, i) {
          se
            ? se
                .screen({ name: e.name, properties: e.properties ?? {} })
                .then((e) => {
                  t(JSON.stringify(e ?? null))
                })
                .catch((e) => {
                  i(e instanceof Error ? e.message : String(e))
                })
            : i('SDK not initialized. Call initialize() first.')
        },
        flush(e, t) {
          se
            ? se
                .flush()
                .then(() => {
                  e(JSON.stringify(null))
                })
                .catch((e) => {
                  t(e instanceof Error ? e.message : String(e))
                })
            : t('SDK not initialized. Call initialize() first.')
        },
        trackView(e, t, i) {
          se
            ? se
                .trackView(e)
                .then((e) => {
                  t(JSON.stringify(e ?? null))
                })
                .catch((e) => {
                  i(e instanceof Error ? e.message : String(e))
                })
            : i('SDK not initialized. Call initialize() first.')
        },
        trackClick(e, t, i) {
          se
            ? se
                .trackClick(e)
                .then(() => {
                  t(JSON.stringify(null))
                })
                .catch((e) => {
                  i(e instanceof Error ? e.message : String(e))
                })
            : i('SDK not initialized. Call initialize() first.')
        },
        consent(e) {
          se && se.consent(e)
        },
        reset() {
          se && (sn?.resetAll(), se.reset())
        },
        setOnline(e) {
          eS.online.value = e
        },
        personalizeEntry: (e, t) =>
          se ? JSON.stringify(se.resolveOptimizedEntry(e, t)) : JSON.stringify({ entry: e }),
        setPreviewPanelOpen(e) {
          se && (eS.previewPanelOpen.value = e)
        },
        overrideAudience(e, t) {
          if (!sn) return
          let i = sn.getOverrides().audiences[e],
            n = i?.experienceIds ?? []
          t ? sn.activateAudience(e, n) : sn.deactivateAudience(e, n)
        },
        overrideVariant(e, t) {
          sn?.setVariantOverride(e, t)
        },
        resetAudienceOverride(e) {
          sn?.resetAudienceOverride(e)
        },
        resetVariantOverride(e) {
          sn?.resetOptimizationOverride(e)
        },
        resetAllOverrides() {
          sn?.resetAll()
        },
        getPreviewState() {
          let e = sn?.getOverrides() ?? { audiences: {}, selectedOptimizations: {} },
            t = sn?.getBaselineSelectedOptimizations(),
            i = {}
          for (let [t, n] of Object.entries(e.audiences)) i[t] = n.isActive
          let n = {}
          for (let [t, i] of Object.entries(e.selectedOptimizations)) n[t] = i.variantIndex
          let r = {}
          if (t)
            for (let e of t) void 0 !== n[e.experienceId] && (r[e.experienceId] = e.variantIndex)
          return JSON.stringify({
            profile: eS.profile.value ?? null,
            consent: eS.consent.value,
            canPersonalize: eS.canOptimize.value,
            changes: eS.changes.value ?? null,
            selectedPersonalizations: eS.selectedOptimizations.value ?? null,
            previewPanelOpen: eS.previewPanelOpen.value,
            audienceOverrides: i,
            variantOverrides: n,
            defaultAudienceQualifications: {},
            defaultVariantIndices: r,
          })
        },
        getProfile() {
          let e = eS.profile.value
          return e ? JSON.stringify(e) : null
        },
        getState: () =>
          JSON.stringify({
            profile: eS.profile.value ?? null,
            consent: eS.consent.value,
            canPersonalize: eS.canOptimize.value,
            changes: eS.changes.value ?? null,
            selectedPersonalizations: eS.selectedOptimizations.value ?? null,
          }),
        destroy() {
          ;(sn?.destroy(),
            (sn = null),
            si && (si(), (si = null)),
            st && (st(), (st = null)),
            se && (se.destroy(), (se = null)))
        },
      }
    globalThis.__bridge = sr
    let ss = sr
    return y.default
  })(),
)
//# sourceMappingURL=optimization-ios-bridge.umd.js.map

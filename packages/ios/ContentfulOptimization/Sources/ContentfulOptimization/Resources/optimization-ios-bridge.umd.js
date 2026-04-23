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
    let e, t, i, n, r, s, o
    var a,
      l = {}
    ;((l.d = (e, t) => {
      for (var i in t)
        l.o(t, i) && !l.o(e, i) && Object.defineProperty(e, i, { enumerable: !0, get: t[i] })
    }),
      (l.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)))
    var u = {}
    l.d(u, { default: () => rg })
    var c = Symbol.for('preact-signals')
    function d() {
      if (g > 1) g--
      else {
        for (var e, t = !1; void 0 !== y; ) {
          var i = y
          for (y = void 0, m++; void 0 !== i; ) {
            var n = i.o
            if (((i.o = void 0), (i.f &= -3), !(8 & i.f) && O(i)))
              try {
                i.c()
              } catch (i) {
                t || ((e = i), (t = !0))
              }
            i = n
          }
        }
        if (((m = 0), g--, t)) throw e
      }
    }
    function f(e) {
      if (g > 0) return e()
      g++
      try {
        return e()
      } finally {
        d()
      }
    }
    var h = void 0
    function p(e) {
      var t = h
      h = void 0
      try {
        return e()
      } finally {
        h = t
      }
    }
    var v,
      y = void 0,
      g = 0,
      m = 0,
      b = 0
    function w(e) {
      if (void 0 !== h) {
        var t = e.n
        if (void 0 === t || t.t !== h)
          return (
            (t = { i: 0, S: e, p: h.s, n: void 0, t: h, e: void 0, x: void 0, r: t }),
            void 0 !== h.s && (h.s.n = t),
            (h.s = t),
            (e.n = t),
            32 & h.f && e.S(t),
            t
          )
        if (-1 === t.i)
          return (
            (t.i = 0),
            void 0 !== t.n &&
              ((t.n.p = t.p),
              void 0 !== t.p && (t.p.n = t.n),
              (t.p = h.s),
              (t.n = void 0),
              (h.s.n = t),
              (h.s = t)),
            t
          )
      }
    }
    function _(e, t) {
      ;((this.v = e),
        (this.i = 0),
        (this.n = void 0),
        (this.t = void 0),
        (this.W = null == t ? void 0 : t.watched),
        (this.Z = null == t ? void 0 : t.unwatched),
        (this.name = null == t ? void 0 : t.name))
    }
    function z(e, t) {
      return new _(e, t)
    }
    function O(e) {
      for (var t = e.s; void 0 !== t; t = t.n)
        if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0
      return !1
    }
    function E(e) {
      for (var t = e.s; void 0 !== t; t = t.n) {
        var i = t.S.n
        if ((void 0 !== i && (t.r = i), (t.S.n = t), (t.i = -1), void 0 === t.n)) {
          e.s = t
          break
        }
      }
    }
    function k(e) {
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
    function S(e, t) {
      ;(_.call(this, void 0),
        (this.x = e),
        (this.s = void 0),
        (this.g = b - 1),
        (this.f = 4),
        (this.W = null == t ? void 0 : t.watched),
        (this.Z = null == t ? void 0 : t.unwatched),
        (this.name = null == t ? void 0 : t.name))
    }
    function x(e, t) {
      return new S(e, t)
    }
    function $(e) {
      var t = e.u
      if (((e.u = void 0), 'function' == typeof t)) {
        g++
        var i = h
        h = void 0
        try {
          t()
        } catch (t) {
          throw ((e.f &= -2), (e.f |= 8), I(e), t)
        } finally {
          ;((h = i), d())
        }
      }
    }
    function I(e) {
      for (var t = e.s; void 0 !== t; t = t.n) t.S.U(t)
      ;((e.x = void 0), (e.s = void 0), $(e))
    }
    function P(e) {
      if (h !== this) throw Error('Out-of-order effect')
      ;(k(this), (h = e), (this.f &= -2), 8 & this.f && I(this), d())
    }
    function j(e, t) {
      ;((this.x = e),
        (this.u = void 0),
        (this.s = void 0),
        (this.o = void 0),
        (this.f = 32),
        (this.name = null == t ? void 0 : t.name),
        v && v.push(this))
    }
    function T(e, t) {
      var i = new j(e, t)
      try {
        i.c()
      } catch (e) {
        throw (i.d(), e)
      }
      var n = i.d.bind(i)
      return ((n[Symbol.dispose] = n), n)
    }
    function F(e) {
      return Object.getOwnPropertySymbols(e).filter((t) =>
        Object.prototype.propertyIsEnumerable.call(e, t),
      )
    }
    function A(e) {
      return null == e
        ? void 0 === e
          ? '[object Undefined]'
          : '[object Null]'
        : Object.prototype.toString.call(e)
    }
    ;((_.prototype.brand = c),
      (_.prototype.h = function () {
        return !0
      }),
      (_.prototype.S = function (e) {
        var t = this,
          i = this.t
        i !== e &&
          void 0 === e.e &&
          ((e.x = i),
          (this.t = e),
          void 0 !== i
            ? (i.e = e)
            : p(function () {
                var e
                null == (e = t.W) || e.call(t)
              }))
      }),
      (_.prototype.U = function (e) {
        var t = this
        if (void 0 !== this.t) {
          var i = e.e,
            n = e.x
          ;(void 0 !== i && ((i.x = n), (e.e = void 0)),
            void 0 !== n && ((n.e = i), (e.x = void 0)),
            e === this.t &&
              ((this.t = n),
              void 0 === n &&
                p(function () {
                  var e
                  null == (e = t.Z) || e.call(t)
                })))
        }
      }),
      (_.prototype.subscribe = function (e) {
        var t = this
        return T(
          function () {
            var i = t.value,
              n = h
            h = void 0
            try {
              e(i)
            } finally {
              h = n
            }
          },
          { name: 'sub' },
        )
      }),
      (_.prototype.valueOf = function () {
        return this.value
      }),
      (_.prototype.toString = function () {
        return this.value + ''
      }),
      (_.prototype.toJSON = function () {
        return this.value
      }),
      (_.prototype.peek = function () {
        var e = h
        h = void 0
        try {
          return this.value
        } finally {
          h = e
        }
      }),
      Object.defineProperty(_.prototype, 'value', {
        get: function () {
          var e = w(this)
          return (void 0 !== e && (e.i = this.i), this.v)
        },
        set: function (e) {
          if (e !== this.v) {
            if (m > 100) throw Error('Cycle detected')
            ;((this.v = e), this.i++, b++, g++)
            try {
              for (var t = this.t; void 0 !== t; t = t.x) t.t.N()
            } finally {
              d()
            }
          }
        },
      }),
      (S.prototype = new _()),
      (S.prototype.h = function () {
        if (((this.f &= -3), 1 & this.f)) return !1
        if (32 == (36 & this.f) || ((this.f &= -5), this.g === b)) return !0
        if (((this.g = b), (this.f |= 1), this.i > 0 && !O(this))) return ((this.f &= -2), !0)
        var e = h
        try {
          ;(E(this), (h = this))
          var t = this.x()
          ;(16 & this.f || this.v !== t || 0 === this.i) &&
            ((this.v = t), (this.f &= -17), this.i++)
        } catch (e) {
          ;((this.v = e), (this.f |= 16), this.i++)
        }
        return ((h = e), k(this), (this.f &= -2), !0)
      }),
      (S.prototype.S = function (e) {
        if (void 0 === this.t) {
          this.f |= 36
          for (var t = this.s; void 0 !== t; t = t.n) t.S.S(t)
        }
        _.prototype.S.call(this, e)
      }),
      (S.prototype.U = function (e) {
        if (void 0 !== this.t && (_.prototype.U.call(this, e), void 0 === this.t)) {
          this.f &= -33
          for (var t = this.s; void 0 !== t; t = t.n) t.S.U(t)
        }
      }),
      (S.prototype.N = function () {
        if (!(2 & this.f)) {
          this.f |= 6
          for (var e = this.t; void 0 !== e; e = e.x) e.t.N()
        }
      }),
      Object.defineProperty(S.prototype, 'value', {
        get: function () {
          if (1 & this.f) throw Error('Cycle detected')
          var e = w(this)
          if ((this.h(), void 0 !== e && (e.i = this.i), 16 & this.f)) throw this.v
          return this.v
        },
      }),
      (j.prototype.c = function () {
        var e = this.S()
        try {
          if (8 & this.f || void 0 === this.x) return
          var t = this.x()
          'function' == typeof t && (this.u = t)
        } finally {
          e()
        }
      }),
      (j.prototype.S = function () {
        if (1 & this.f) throw Error('Cycle detected')
        ;((this.f |= 1), (this.f &= -9), $(this), E(this), g++)
        var e = h
        return ((h = this), P.bind(this, e))
      }),
      (j.prototype.N = function () {
        2 & this.f || ((this.f |= 2), (this.o = y), (y = this))
      }),
      (j.prototype.d = function () {
        ;((this.f |= 8), 1 & this.f || I(this))
      }),
      (j.prototype.dispose = function () {
        this.d()
      }))
    let R = '[object RegExp]',
      M = '[object String]',
      C = '[object Number]',
      B = '[object Boolean]',
      q = '[object Arguments]',
      U = '[object Symbol]',
      N = '[object Date]',
      V = '[object Map]',
      D = '[object Set]',
      Z = '[object Array]',
      L = '[object ArrayBuffer]',
      Q = '[object Object]',
      J = '[object DataView]',
      H = '[object Uint8Array]',
      K = '[object Uint8ClampedArray]',
      W = '[object Uint16Array]',
      G = '[object Uint32Array]',
      X = '[object Int8Array]',
      Y = '[object Int16Array]',
      ee = '[object Int32Array]',
      et = '[object Float32Array]',
      ei = '[object Float64Array]'
    function en(e, t, i, n = new Map(), r) {
      let s = r?.(e, t, i, n)
      if (void 0 !== s) return s
      if (null == e || ('object' != typeof e && 'function' != typeof e)) return e
      if (n.has(e)) return n.get(e)
      if (Array.isArray(e)) {
        let t = Array(e.length)
        n.set(e, t)
        for (let s = 0; s < e.length; s++) t[s] = en(e[s], s, i, n, r)
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
        for (let [s, o] of (n.set(e, t), e)) t.set(s, en(o, s, i, n, r))
        return t
      }
      if (e instanceof Set) {
        let t = new Set()
        for (let s of (n.set(e, t), e)) t.add(en(s, void 0, i, n, r))
        return t
      }
      if ('u' > typeof Buffer && Buffer.isBuffer(e)) return e.subarray()
      if (ArrayBuffer.isView(e) && !(e instanceof DataView)) {
        let t = new (Object.getPrototypeOf(e).constructor)(e.length)
        n.set(e, t)
        for (let s = 0; s < e.length; s++) t[s] = en(e[s], s, i, n, r)
        return t
      }
      if (
        e instanceof ArrayBuffer ||
        ('u' > typeof SharedArrayBuffer && e instanceof SharedArrayBuffer)
      )
        return e.slice(0)
      if (e instanceof DataView) {
        let t = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength)
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      if ('u' > typeof File && e instanceof File) {
        let t = new File([e], e.name, { type: e.type })
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      if ('u' > typeof Blob && e instanceof Blob) {
        let t = new Blob([e], { type: e.type })
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      if (e instanceof Error) {
        let t = new e.constructor()
        return (
          n.set(e, t),
          (t.message = e.message),
          (t.name = e.name),
          (t.stack = e.stack),
          (t.cause = e.cause),
          er(t, e, i, n, r),
          t
        )
      }
      if (e instanceof Boolean) {
        let t = new Boolean(e.valueOf())
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      if (e instanceof Number) {
        let t = new Number(e.valueOf())
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      if (e instanceof String) {
        let t = new String(e.valueOf())
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      if (
        'object' == typeof e &&
        (function (e) {
          switch (A(e)) {
            case q:
            case Z:
            case L:
            case J:
            case B:
            case N:
            case et:
            case ei:
            case X:
            case Y:
            case ee:
            case V:
            case C:
            case Q:
            case R:
            case D:
            case M:
            case U:
            case H:
            case K:
            case W:
            case G:
              return !0
            default:
              return !1
          }
        })(e)
      ) {
        let t = Object.create(Object.getPrototypeOf(e))
        return (n.set(e, t), er(t, e, i, n, r), t)
      }
      return e
    }
    function er(e, t, i = e, n, r) {
      let s = [...Object.keys(t), ...F(t)]
      for (let o = 0; o < s.length; o++) {
        let a = s[o],
          l = Object.getOwnPropertyDescriptor(e, a)
        ;(null == l || l.writable) && (e[a] = en(t[a], a, i, n, r))
      }
    }
    function es(e) {
      return en(e, void 0, e, new Map(), void 0)
    }
    function eo(e) {
      return {
        get current() {
          return es(e.value)
        },
        subscribe: (t) => ({
          unsubscribe: T(() => {
            t(es(e.value))
          }),
        }),
        subscribeOnce(t) {
          let i = !1,
            n = !1,
            r = () => void 0
          return (
            (r = T(() => {
              if (i) return
              let { value: s } = e
              if (null == s) return
              i = !0
              let o = null
              try {
                t(es(s))
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
    let ea = z(),
      el = z(),
      eu = z(),
      ec = z(),
      ed = z(!0),
      ef = z(!1),
      eh = z(!1),
      ep = z(),
      ev = x(() => void 0 !== ep.value),
      ey = z(),
      eg = {
        blockedEvent: el,
        changes: ea,
        consent: eu,
        event: ec,
        online: ed,
        previewPanelAttached: ef,
        previewPanelOpen: eh,
        selectedOptimizations: ep,
        canOptimize: ev,
        profile: ey,
      },
      em = { batch: f, computed: x, effect: T, untracked: p }
    function eb(e, t, i) {
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
    class ew extends Error {
      constructor() {
        super('Encountered Promise during synchronous parse. Use .parseAsync() instead.')
      }
    }
    let e_ = {}
    function ez(e) {
      return (e && Object.assign(e_, e), e_)
    }
    function eO(e, t = '|') {
      return e.map((e) => eB(e)).join(t)
    }
    function eE(e, t) {
      return 'bigint' == typeof t ? t.toString() : t
    }
    function ek(e) {
      return {
        get value() {
          {
            let t = e()
            return (Object.defineProperty(this, 'value', { value: t }), t)
          }
        },
      }
    }
    function eS(e) {
      let t = +!!e.startsWith('^'),
        i = e.endsWith('$') ? e.length - 1 : e.length
      return e.slice(t, i)
    }
    let ex = Symbol('evaluating')
    function e$(e, t, i) {
      let n
      Object.defineProperty(e, t, {
        get() {
          if (n !== ex) return (void 0 === n && ((n = ex), (n = i())), n)
        },
        set(i) {
          Object.defineProperty(e, t, { value: i })
        },
        configurable: !0,
      })
    }
    function eI(e, t, i) {
      Object.defineProperty(e, t, { value: i, writable: !0, enumerable: !0, configurable: !0 })
    }
    function eP(...e) {
      let t = {}
      for (let i of e) Object.assign(t, Object.getOwnPropertyDescriptors(i))
      return Object.defineProperties({}, t)
    }
    let ej = 'captureStackTrace' in Error ? Error.captureStackTrace : (...e) => {}
    function eT(e) {
      return 'object' == typeof e && null !== e && !Array.isArray(e)
    }
    function eF(e) {
      if (!1 === eT(e)) return !1
      let t = e.constructor
      if (void 0 === t || 'function' != typeof t) return !0
      let i = t.prototype
      return !1 !== eT(i) && !1 !== Object.prototype.hasOwnProperty.call(i, 'isPrototypeOf')
    }
    ek(() => {
      if ('u' > typeof navigator && navigator?.userAgent?.includes('Cloudflare')) return !1
      try {
        return (Function(''), !0)
      } catch (e) {
        return !1
      }
    })
    let eA = new Set(['string', 'number', 'symbol'])
    function eR(e) {
      return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    function eM(e, t, i) {
      let n = new e._zod.constr(t ?? e._zod.def)
      return ((!t || i?.parent) && (n._zod.parent = e), n)
    }
    function eC(e) {
      if (!e) return {}
      if ('string' == typeof e) return { error: () => e }
      if (e?.message !== void 0) {
        if (e?.error !== void 0) throw Error('Cannot specify both `message` and `error` params')
        e.error = e.message
      }
      return (delete e.message, 'string' == typeof e.error) ? { ...e, error: () => e.error } : e
    }
    function eB(e) {
      return 'bigint' == typeof e ? e.toString() + 'n' : 'string' == typeof e ? `"${e}"` : `${e}`
    }
    function eq(e, t = 0) {
      if (!0 === e.aborted) return !0
      for (let i = t; i < e.issues.length; i++) if (e.issues[i]?.continue !== !0) return !0
      return !1
    }
    function eU(e, t) {
      return t.map((t) => (t.path ?? (t.path = []), t.path.unshift(e), t))
    }
    function eN(e) {
      return 'string' == typeof e ? e : e?.message
    }
    function eV(e, t, i) {
      let n = { ...e, path: e.path ?? [] }
      return (
        e.message ||
          (n.message =
            eN(e.inst?._zod.def?.error?.(e)) ??
            eN(t?.error?.(e)) ??
            eN(i.customError?.(e)) ??
            eN(i.localeError?.(e)) ??
            'Invalid input'),
        delete n.inst,
        delete n.continue,
        t?.reportInput || delete n.input,
        n
      )
    }
    function eD(e) {
      return Array.isArray(e) ? 'array' : 'string' == typeof e ? 'string' : 'unknown'
    }
    let eZ = (e, t) => {
        ;((e.name = '$ZodError'),
          Object.defineProperty(e, '_zod', { value: e._zod, enumerable: !1 }),
          Object.defineProperty(e, 'issues', { value: t, enumerable: !1 }),
          (e.message = JSON.stringify(t, eE, 2)),
          Object.defineProperty(e, 'toString', { value: () => e.message, enumerable: !1 }))
      },
      eL = eb('$ZodError', eZ),
      eQ = eb('$ZodError', eZ, { Parent: Error }),
      eJ =
        ((e = eQ),
        (t, i, n, r) => {
          let s = n ? Object.assign(n, { async: !1 }) : { async: !1 },
            o = t._zod.run({ value: i, issues: [] }, s)
          if (o instanceof Promise) throw new ew()
          if (o.issues.length) {
            let t = new (r?.Err ?? e)(o.issues.map((e) => eV(e, s, ez())))
            throw (ej(t, r?.callee), t)
          }
          return o.value
        }),
      eH =
        ((t = eQ),
        async (e, i, n, r) => {
          let s = n ? Object.assign(n, { async: !0 }) : { async: !0 },
            o = e._zod.run({ value: i, issues: [] }, s)
          if ((o instanceof Promise && (o = await o), o.issues.length)) {
            let e = new (r?.Err ?? t)(o.issues.map((e) => eV(e, s, ez())))
            throw (ej(e, r?.callee), e)
          }
          return o.value
        }),
      eK =
        ((i = eQ),
        (e, t, n) => {
          let r = n ? { ...n, async: !1 } : { async: !1 },
            s = e._zod.run({ value: t, issues: [] }, r)
          if (s instanceof Promise) throw new ew()
          return s.issues.length
            ? { success: !1, error: new (i ?? eL)(s.issues.map((e) => eV(e, r, ez()))) }
            : { success: !0, data: s.value }
        }),
      eW =
        ((n = eQ),
        async (e, t, i) => {
          let r = i ? Object.assign(i, { async: !0 }) : { async: !0 },
            s = e._zod.run({ value: t, issues: [] }, r)
          return (
            s instanceof Promise && (s = await s),
            s.issues.length
              ? { success: !1, error: new n(s.issues.map((e) => eV(e, r, ez()))) }
              : { success: !0, data: s.value }
          )
        }),
      eG =
        /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/,
      eX =
        '(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))',
      eY = RegExp(`^${eX}$`)
    function e0(e) {
      let t = '(?:[01]\\d|2[0-3]):[0-5]\\d'
      return 'number' == typeof e.precision
        ? -1 === e.precision
          ? `${t}`
          : 0 === e.precision
            ? `${t}:[0-5]\\d`
            : `${t}:[0-5]\\d\\.\\d{${e.precision}}`
        : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`
    }
    let e1 = /^-?\d+(?:\.\d+)?$/,
      e2 = /^(?:true|false)$/i,
      e6 = /^null$/i,
      e3 = eb('$ZodCheck', (e, t) => {
        var i
        ;(e._zod ?? (e._zod = {}), (e._zod.def = t), (i = e._zod).onattach ?? (i.onattach = []))
      }),
      e4 = eb('$ZodCheckMinLength', (e, t) => {
        var i
        ;(e3.init(e, t),
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
            let r = eD(n)
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
      e8 = eb('$ZodCheckLengthEquals', (e, t) => {
        var i
        ;(e3.init(e, t),
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
            let s = eD(n),
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
      e5 = eb('$ZodCheckStringFormat', (e, t) => {
        var i, n
        ;(e3.init(e, t),
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
      e9 = { major: 4, minor: 3, patch: 6 },
      e7 = eb('$ZodType', (e, t) => {
        var i
        ;(e ?? (e = {}), (e._zod.def = t), (e._zod.bag = e._zod.bag || {}), (e._zod.version = e9))
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
                r = eq(e)
              for (let s of t) {
                if (s._zod.def.when) {
                  if (!s._zod.def.when(e)) continue
                } else if (r) continue
                let t = e.issues.length,
                  o = s._zod.check(e)
                if (o instanceof Promise && i?.async === !1) throw new ew()
                if (n || o instanceof Promise)
                  n = (n ?? Promise.resolve()).then(async () => {
                    ;(await o, e.issues.length !== t && (r || (r = eq(e, t))))
                  })
                else {
                  if (e.issues.length === t) continue
                  r || (r = eq(e, t))
                }
              }
              return n ? n.then(() => e) : e
            },
            i = (i, r, s) => {
              if (eq(i)) return ((i.aborted = !0), i)
              let o = t(r, n, s)
              if (o instanceof Promise) {
                if (!1 === s.async) throw new ew()
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
              if (!1 === s.async) throw new ew()
              return o.then((e) => t(e, n, s))
            }
            return t(o, n, s)
          }
        }
        e$(e, '~standard', () => ({
          validate: (t) => {
            try {
              let i = eK(e, t)
              return i.success ? { value: i.data } : { issues: i.error?.issues }
            } catch (i) {
              return eW(e, t).then((e) =>
                e.success ? { value: e.data } : { issues: e.error?.issues },
              )
            }
          },
          vendor: 'zod',
          version: 1,
        }))
      }),
      te = eb('$ZodString', (e, t) => {
        var i
        let n
        ;(e7.init(e, t),
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
      tt = eb('$ZodStringFormat', (e, t) => {
        ;(e5.init(e, t), te.init(e, t))
      }),
      ti = eb('$ZodISODateTime', (e, t) => {
        let i, n, r
        ;(t.pattern ??
          ((i = e0({ precision: t.precision })),
          (n = ['Z']),
          t.local && n.push(''),
          t.offset && n.push('([+-](?:[01]\\d|2[0-3]):[0-5]\\d)'),
          (r = `${i}(?:${n.join('|')})`),
          (t.pattern = RegExp(`^${eX}T(?:${r})$`))),
          tt.init(e, t))
      }),
      tn =
        ((e, t) => {
          ;(t.pattern ?? (t.pattern = eY), tt.init(e, t))
        },
        eb('$ZodNumber', (e, t) => {
          ;(e7.init(e, t),
            (e._zod.pattern = e._zod.bag.pattern ?? e1),
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
      tr = eb('$ZodBoolean', (e, t) => {
        ;(e7.init(e, t),
          (e._zod.pattern = e2),
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
      ts = eb('$ZodNull', (e, t) => {
        ;(e7.init(e, t),
          (e._zod.pattern = e6),
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
      to = eb('$ZodAny', (e, t) => {
        ;(e7.init(e, t), (e._zod.parse = (e) => e))
      }),
      ta = eb('$ZodUnknown', (e, t) => {
        ;(e7.init(e, t), (e._zod.parse = (e) => e))
      })
    function tl(e, t, i) {
      ;(e.issues.length && t.issues.push(...eU(i, e.issues)), (t.value[i] = e.value))
    }
    let tu = eb('$ZodArray', (e, t) => {
      ;(e7.init(e, t),
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
            a instanceof Promise ? s.push(a.then((t) => tl(t, i, e))) : tl(a, i, e)
          }
          return s.length ? Promise.all(s).then(() => i) : i
        }))
    })
    function tc(e, t, i, n, r) {
      if (e.issues.length) {
        if (r && !(i in n)) return
        t.issues.push(...eU(i, e.issues))
      }
      void 0 === e.value ? i in n && (t.value[i] = void 0) : (t.value[i] = e.value)
    }
    let td = eb('$ZodObject', (e, t) => {
      let i
      e7.init(e, t)
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
      let r = ek(() =>
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
      e$(e._zod, 'propValues', () => {
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
        if (!eT(o))
          return (t.issues.push({ expected: 'object', code: 'invalid_type', input: o, inst: e }), t)
        t.value = {}
        let a = [],
          l = i.shape
        for (let e of i.keys) {
          let i = l[e],
            r = 'optional' === i._zod.optout,
            s = i._zod.run({ value: o[e], issues: [] }, n)
          s instanceof Promise ? a.push(s.then((i) => tc(i, t, e, o, r))) : tc(s, t, e, o, r)
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
                s instanceof Promise ? e.push(s.then((e) => tc(e, i, r, t, c))) : tc(s, i, r, t, c)
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
    function tf(e, t, i, n) {
      for (let i of e) if (0 === i.issues.length) return ((t.value = i.value), t)
      let r = e.filter((e) => !eq(e))
      return 1 === r.length
        ? ((t.value = r[0].value), r[0])
        : (t.issues.push({
            code: 'invalid_union',
            input: t.value,
            inst: i,
            errors: e.map((e) => e.issues.map((e) => eV(e, n, ez()))),
          }),
          t)
    }
    let th = eb('$ZodUnion', (e, t) => {
        ;(e7.init(e, t),
          e$(e._zod, 'optin', () =>
            t.options.some((e) => 'optional' === e._zod.optin) ? 'optional' : void 0,
          ),
          e$(e._zod, 'optout', () =>
            t.options.some((e) => 'optional' === e._zod.optout) ? 'optional' : void 0,
          ),
          e$(e._zod, 'values', () => {
            if (t.options.every((e) => e._zod.values))
              return new Set(t.options.flatMap((e) => Array.from(e._zod.values)))
          }),
          e$(e._zod, 'pattern', () => {
            if (t.options.every((e) => e._zod.pattern)) {
              let e = t.options.map((e) => e._zod.pattern)
              return RegExp(`^(${e.map((e) => eS(e.source)).join('|')})$`)
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
          return o ? Promise.all(a).then((t) => tf(t, r, e, s)) : tf(a, r, e, s)
        }
      }),
      tp = eb('$ZodDiscriminatedUnion', (e, t) => {
        ;((t.inclusive = !1), th.init(e, t))
        let i = e._zod.parse
        e$(e._zod, 'propValues', () => {
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
        let n = ek(() => {
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
          if (!eT(o))
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
      tv = eb('$ZodRecord', (e, t) => {
        ;(e7.init(e, t),
          (e._zod.parse = (i, n) => {
            let r = i.value
            if (!eF(r))
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
                          ;(t.issues.length && i.issues.push(...eU(e, t.issues)),
                            (i.value[e] = t.value))
                        }),
                      )
                    : (o.issues.length && i.issues.push(...eU(e, o.issues)), (i.value[e] = o.value))
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
                if ('string' == typeof o && e1.test(o) && a.issues.length) {
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
                        issues: a.issues.map((e) => eV(e, n, ez())),
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
                        ;(e.issues.length && i.issues.push(...eU(o, e.issues)),
                          (i.value[a.value] = e.value))
                      }),
                    )
                  : (l.issues.length && i.issues.push(...eU(o, l.issues)),
                    (i.value[a.value] = l.value))
              }
            return s.length ? Promise.all(s).then(() => i) : i
          }))
      }),
      ty = eb('$ZodEnum', (e, t) => {
        var i
        let n
        e7.init(e, t)
        let r =
            ((n = Object.values((i = t.entries)).filter((e) => 'number' == typeof e)),
            Object.entries(i)
              .filter(([e, t]) => -1 === n.indexOf(+e))
              .map(([e, t]) => t)),
          s = new Set(r)
        ;((e._zod.values = s),
          (e._zod.pattern = RegExp(
            `^(${r
              .filter((e) => eA.has(typeof e))
              .map((e) => ('string' == typeof e ? eR(e) : e.toString()))
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
      tg = eb('$ZodLiteral', (e, t) => {
        if ((e7.init(e, t), 0 === t.values.length))
          throw Error('Cannot create literal schema with no valid values')
        let i = new Set(t.values)
        ;((e._zod.values = i),
          (e._zod.pattern = RegExp(
            `^(${t.values.map((e) => ('string' == typeof e ? eR(e) : e ? eR(e.toString()) : String(e))).join('|')})$`,
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
    function tm(e, t) {
      return e.issues.length && void 0 === t ? { issues: [], value: void 0 } : e
    }
    let tb = eb('$ZodOptional', (e, t) => {
        ;(e7.init(e, t),
          (e._zod.optin = 'optional'),
          (e._zod.optout = 'optional'),
          e$(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, void 0]) : void 0,
          ),
          e$(e._zod, 'pattern', () => {
            let e = t.innerType._zod.pattern
            return e ? RegExp(`^(${eS(e.source)})?$`) : void 0
          }),
          (e._zod.parse = (e, i) => {
            if ('optional' === t.innerType._zod.optin) {
              let n = t.innerType._zod.run(e, i)
              return n instanceof Promise ? n.then((t) => tm(t, e.value)) : tm(n, e.value)
            }
            return void 0 === e.value ? e : t.innerType._zod.run(e, i)
          }))
      }),
      tw = eb('$ZodNullable', (e, t) => {
        ;(e7.init(e, t),
          e$(e._zod, 'optin', () => t.innerType._zod.optin),
          e$(e._zod, 'optout', () => t.innerType._zod.optout),
          e$(e._zod, 'pattern', () => {
            let e = t.innerType._zod.pattern
            return e ? RegExp(`^(${eS(e.source)}|null)$`) : void 0
          }),
          e$(e._zod, 'values', () =>
            t.innerType._zod.values ? new Set([...t.innerType._zod.values, null]) : void 0,
          ),
          (e._zod.parse = (e, i) => (null === e.value ? e : t.innerType._zod.run(e, i))))
      }),
      t_ = eb('$ZodPrefault', (e, t) => {
        ;(e7.init(e, t),
          (e._zod.optin = 'optional'),
          e$(e._zod, 'values', () => t.innerType._zod.values),
          (e._zod.parse = (e, i) => (
            'backward' === i.direction || (void 0 === e.value && (e.value = t.defaultValue)),
            t.innerType._zod.run(e, i)
          )))
      }),
      tz = eb('$ZodLazy', (e, t) => {
        ;(e7.init(e, t),
          e$(e._zod, 'innerType', () => t.getter()),
          e$(e._zod, 'pattern', () => e._zod.innerType?._zod?.pattern),
          e$(e._zod, 'propValues', () => e._zod.innerType?._zod?.propValues),
          e$(e._zod, 'optin', () => e._zod.innerType?._zod?.optin ?? void 0),
          e$(e._zod, 'optout', () => e._zod.innerType?._zod?.optout ?? void 0),
          (e._zod.parse = (t, i) => e._zod.innerType._zod.run(t, i)))
      })
    ;(Symbol('ZodOutput'), Symbol('ZodInput'))
    function tO(e, t) {
      return new e4({ check: 'min_length', ...eC(t), minimum: e })
    }
    ;(a = globalThis).__zod_globalRegistry ??
      (a.__zod_globalRegistry = new (class e {
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
    let tE = eb('ZodMiniType', (e, t) => {
        if (!e._zod) throw Error('Uninitialized schema in ZodMiniType.')
        ;(e7.init(e, t),
          (e.def = t),
          (e.type = t.type),
          (e.parse = (t, i) => eJ(e, t, i, { callee: e.parse })),
          (e.safeParse = (t, i) => eK(e, t, i)),
          (e.parseAsync = async (t, i) => eH(e, t, i, { callee: e.parseAsync })),
          (e.safeParseAsync = async (t, i) => eW(e, t, i)),
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
          (e.clone = (t, i) => eM(e, t, i)),
          (e.brand = () => e),
          (e.register = (t, i) => (t.add(e, i), e)),
          (e.apply = (t) => t(e)))
      }),
      tk = eb('ZodMiniString', (e, t) => {
        ;(te.init(e, t), tE.init(e, t))
      })
    function tS(e) {
      return new tk({ type: 'string', ...eC(e) })
    }
    let tx = eb('ZodMiniStringFormat', (e, t) => {
        ;(tt.init(e, t), tk.init(e, t))
      }),
      t$ = eb('ZodMiniNumber', (e, t) => {
        ;(tn.init(e, t), tE.init(e, t))
      })
    function tI(e) {
      return new t$({ type: 'number', checks: [], ...eC(e) })
    }
    let tP = eb('ZodMiniBoolean', (e, t) => {
      ;(tr.init(e, t), tE.init(e, t))
    })
    function tj(e) {
      return new tP({ type: 'boolean', ...eC(e) })
    }
    let tT = eb('ZodMiniNull', (e, t) => {
      ;(ts.init(e, t), tE.init(e, t))
    })
    function tF(e) {
      return new tT({ type: 'null', ...eC(e) })
    }
    let tA = eb('ZodMiniAny', (e, t) => {
      ;(to.init(e, t), tE.init(e, t))
    })
    function tR() {
      return new tA({ type: 'any' })
    }
    let tM = eb('ZodMiniUnknown', (e, t) => {
        ;(ta.init(e, t), tE.init(e, t))
      }),
      tC = eb('ZodMiniArray', (e, t) => {
        ;(tu.init(e, t), tE.init(e, t))
      })
    function tB(e, t) {
      return new tC({ type: 'array', element: e, ...eC(t) })
    }
    let tq = eb('ZodMiniObject', (e, t) => {
      ;(td.init(e, t), tE.init(e, t), e$(e, 'shape', () => t.shape))
    })
    function tU(e, t) {
      return new tq({ type: 'object', shape: e ?? {}, ...eC(t) })
    }
    function tN(e, t) {
      if (!eF(t)) throw Error('Invalid input to extend: expected a plain object')
      let i = e._zod.def.checks
      if (i && i.length > 0) {
        let i = e._zod.def.shape
        for (let e in t)
          if (void 0 !== Object.getOwnPropertyDescriptor(i, e))
            throw Error(
              'Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.',
            )
      }
      let n = eP(e._zod.def, {
        get shape() {
          let i = { ...e._zod.def.shape, ...t }
          return (eI(this, 'shape', i), i)
        },
      })
      return eM(e, n)
    }
    function tV(e, t) {
      return e.clone({ ...e._zod.def, catchall: t })
    }
    let tD = eb('ZodMiniUnion', (e, t) => {
      ;(th.init(e, t), tE.init(e, t))
    })
    function tZ(e, t) {
      return new tD({ type: 'union', options: e, ...eC(t) })
    }
    let tL = eb('ZodMiniDiscriminatedUnion', (e, t) => {
      ;(tp.init(e, t), tE.init(e, t))
    })
    function tQ(e, t, i) {
      return new tL({ type: 'union', options: t, discriminator: e, ...eC(i) })
    }
    let tJ = eb('ZodMiniRecord', (e, t) => {
      ;(tv.init(e, t), tE.init(e, t))
    })
    function tH(e, t, i) {
      return new tJ({ type: 'record', keyType: e, valueType: t, ...eC(i) })
    }
    let tK = eb('ZodMiniEnum', (e, t) => {
      ;(ty.init(e, t), tE.init(e, t), (e.options = Object.values(t.entries)))
    })
    function tW(e, t) {
      return new tK({
        type: 'enum',
        entries: Array.isArray(e) ? Object.fromEntries(e.map((e) => [e, e])) : e,
        ...eC(t),
      })
    }
    let tG = eb('ZodMiniLiteral', (e, t) => {
      ;(tg.init(e, t), tE.init(e, t))
    })
    function tX(e, t) {
      return new tG({ type: 'literal', values: Array.isArray(e) ? e : [e], ...eC(t) })
    }
    let tY = eb('ZodMiniOptional', (e, t) => {
      ;(tb.init(e, t), tE.init(e, t))
    })
    function t0(e) {
      return new tY({ type: 'optional', innerType: e })
    }
    let t1 = eb('ZodMiniNullable', (e, t) => {
      ;(tw.init(e, t), tE.init(e, t))
    })
    function t2(e) {
      return new t1({ type: 'nullable', innerType: e })
    }
    let t6 = eb('ZodMiniPrefault', (e, t) => {
      ;(t_.init(e, t), tE.init(e, t))
    })
    function t3(e, t) {
      return new t6({
        type: 'prefault',
        innerType: e,
        get defaultValue() {
          return 'function' == typeof t ? t() : eF(t) ? { ...t } : Array.isArray(t) ? [...t] : t
        },
      })
    }
    let t4 = eb('ZodMiniLazy', (e, t) => {
      ;(tz.init(e, t), tE.init(e, t))
    })
    function t8() {
      let e = new t4({
        type: 'lazy',
        getter: () => tZ([tS(), tI(), tj(), tF(), tB(e), tH(tS(), e)]),
      })
      return e
    }
    let t5 = eb('ZodMiniISODateTime', (e, t) => {
      ;(ti.init(e, t), tx.init(e, t))
    })
    function t9(e) {
      return new t5({
        type: 'string',
        format: 'datetime',
        check: 'string_format',
        offset: !1,
        local: !1,
        precision: null,
        ...eC(e),
      })
    }
    let t7 = tV(tU({}), t8()),
      ie = tU({ sys: tU({ type: tX('Link'), linkType: tS(), id: tS() }) }),
      it = tU({ sys: tU({ type: tX('Link'), linkType: tX('ContentType'), id: tS() }) }),
      ii = tU({ sys: tU({ type: tX('Link'), linkType: tX('Environment'), id: tS() }) }),
      ir = tU({ sys: tU({ type: tX('Link'), linkType: tX('Space'), id: tS() }) }),
      is = tU({ sys: tU({ type: tX('Link'), linkType: tX('TaxonomyConcept'), id: tS() }) }),
      io = tU({ sys: tU({ type: tX('Link'), linkType: tX('Tag'), id: tS() }) }),
      ia = tU({
        type: tX('Entry'),
        contentType: it,
        publishedVersion: tI(),
        id: tS(),
        createdAt: tR(),
        updatedAt: tR(),
        locale: t0(tS()),
        revision: tI(),
        space: ir,
        environment: ii,
      }),
      il = tU({ fields: t7, metadata: tU({ tags: tB(io), concepts: t0(tB(is)) }), sys: ia }),
      iu = tN(t7, { nt_audience_id: tS(), nt_name: t0(tS()), nt_description: t0(tS()) }),
      ic = tN(il, { fields: iu })
    tU({ contentTypeId: tX('nt_audience'), fields: iu })
    let id = tN(il, {
        fields: tU({ nt_name: tS(), nt_fallback: t0(tS()), nt_mergetag_id: tS() }),
        sys: tN(ia, {
          contentType: tU({
            sys: tU({ type: tX('Link'), linkType: tX('ContentType'), id: tX('nt_mergetag') }),
          }),
        }),
      }),
      ih = tU({ id: tS(), hidden: t0(tj()) }),
      ip = tU({ type: t0(tX('EntryReplacement')), baseline: ih, variants: tB(ih) }),
      iv = tU({ value: tZ([tS(), tj(), tF(), tI(), tH(tS(), t8())]) }),
      iy = tW(['Boolean', 'Number', 'Object', 'String']),
      ig = tQ('type', [
        ip,
        tU({
          type: tX('InlineVariable'),
          key: tS(),
          valueType: iy,
          baseline: iv,
          variants: tB(iv),
        }),
      ]),
      im = tB(ig),
      ib = tU({
        distribution: t0(tB(tI())),
        traffic: t0(tI()),
        components: t0(im),
        sticky: t0(tj()),
      }),
      iw = tZ([tX('nt_experiment'), tX('nt_personalization')]),
      i_ = tN(t7, {
        nt_name: tS(),
        nt_description: t0(t2(tS())),
        nt_type: iw,
        nt_config: t0(t2(ib)),
        nt_audience: t0(t2(ic)),
        nt_variants: t0(tB(tZ([ie, il]))),
        nt_experience_id: tS(),
      }),
      iz = tN(il, { fields: i_ })
    tU({ contentTypeId: tX('nt_experience'), fields: i_ })
    let iO = tN(il, { fields: tN(t7, { nt_experiences: tB(tZ([ie, iz])) }) })
    function iE(e) {
      return iz.safeParse(e).success
    }
    function ik(e) {
      return iO.safeParse(e).success
    }
    let iS = t0(tU({ name: tS(), version: tS() })),
      ix = tU({
        name: t0(tS()),
        source: t0(tS()),
        medium: t0(tS()),
        term: t0(tS()),
        content: t0(tS()),
      }),
      i$ = tZ([tX('mobile'), tX('server'), tX('web')]),
      iI = tH(tS(), tS()),
      iP = tU({ latitude: tI(), longitude: tI() }),
      ij = tU({
        coordinates: t0(iP),
        city: t0(tS()),
        postalCode: t0(tS()),
        region: t0(tS()),
        regionCode: t0(tS()),
        country: t0(tS()),
        countryCode: t0(tS().check(new e8({ check: 'length_equals', ...eC(void 0), length: 2 }))),
        continent: t0(tS()),
        timezone: t0(tS()),
      }),
      iT = tU({ name: tS(), version: tS() }),
      iF = tV(
        tU({ path: tS(), query: iI, referrer: tS(), search: tS(), title: t0(tS()), url: tS() }),
        t8(),
      ),
      iA = tH(tS(), t8()),
      iR = tV(tU({ name: tS() }), t8()),
      iM = tH(tS(), t8()),
      iC = tU({
        app: iS,
        campaign: ix,
        gdpr: tU({ isConsentGiven: tj() }),
        library: iT,
        locale: tS(),
        location: t0(ij),
        userAgent: t0(tS()),
      }),
      iB = tU({
        channel: i$,
        context: tN(iC, { page: t0(iF), screen: t0(iR) }),
        messageId: tS(),
        originalTimestamp: t9(),
        sentAt: t9(),
        timestamp: t9(),
        userId: t0(tS()),
      }),
      iq = tN(iB, { type: tX('alias') }),
      iU = tN(iB, { type: tX('group') }),
      iN = tN(iB, { type: tX('identify'), traits: iM }),
      iV = tN(iC, { page: iF }),
      iD = tN(iB, { type: tX('page'), name: t0(tS()), properties: iF, context: iV }),
      iZ = tN(iC, { screen: iR }),
      iL = tN(iB, { type: tX('screen'), name: tS(), properties: t0(iA), context: iZ }),
      iQ = tN(iB, { type: tX('track'), event: tS(), properties: iA }),
      iJ = tN(iB, {
        componentType: tZ([tX('Entry'), tX('Variable')]),
        componentId: tS(),
        experienceId: t0(tS()),
        variantIndex: tI(),
      }),
      iH = tN(iJ, { type: tX('component'), viewDurationMs: t0(tI()), viewId: t0(tS()) }),
      iK = { anonymousId: tS() },
      iW = tB(
        tQ('type', [
          tN(iq, iK),
          tN(iH, iK),
          tN(iU, iK),
          tN(iN, iK),
          tN(iD, iK),
          tN(iL, iK),
          tN(iQ, iK),
        ]),
      ),
      iG = tQ('type', [iq, iH, iU, iN, iD, iL, iQ]),
      iX = tB(iG),
      iY = tU({ features: t0(tB(tS())) }),
      i0 = tU({ events: iX.check(tO(1)), options: t0(iY) }),
      i1 = tU({ events: iW.check(tO(1)), options: t0(iY) }),
      i2 = tU({
        id: tS(),
        isReturningVisitor: tj(),
        landingPage: iF,
        count: tI(),
        activeSessionLength: tI(),
        averageSessionLength: tI(),
      }),
      i6 = tU({
        id: tS(),
        stableId: tS(),
        random: tI(),
        audiences: tB(tS()),
        traits: iM,
        location: ij,
        session: i2,
      }),
      i3 = tV(tU({ id: tS() }), t8()),
      i4 = tU({ data: tU(), message: tS(), error: t2(tj()) }),
      i8 = tN(i4, { data: tU({ profiles: t0(tB(i6)) }) }),
      i5 = tU({
        key: tS(),
        type: tZ([tW(['Variable']), tS()]),
        meta: tU({ experienceId: tS(), variantIndex: tI() }),
      }),
      i9 = tZ([tS(), tj(), tF(), tI(), tH(tS(), t8())])
    tN(i5, { type: tS(), value: new tM({ type: 'unknown' }) })
    let i7 = tB(tQ('type', [tN(i5, { type: tX('Variable'), value: i9 })])),
      ne = tB(
        tU({
          experienceId: tS(),
          variantIndex: tI(),
          variants: tH(tS(), tS()),
          sticky: t0(t3(tj(), !1)),
        }),
      ),
      nt = tN(i4, { data: tU({ profile: i6, experiences: ne, changes: i7 }) }),
      ni = tQ('type', [
        iH,
        tN(iJ, { type: tX('component_click') }),
        tN(iJ, { type: tX('component_hover'), hoverDurationMs: tI(), hoverId: tS() }),
      ]),
      nn = tU({ profile: i3, events: tB(ni) }),
      nr = tB(nn)
    function ns(e, t) {
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
    ez({
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
              if (1 === e.values.length) return `Invalid input: expected ${eB(e.values[0])}`
              return `Invalid option: expected one of ${eO(e.values, '|')}`
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
              return `Unrecognized key${e.keys.length > 1 ? 's' : ''}: ${eO(e.keys, ', ')}`
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
    let no = new (class {
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
    function na(e) {
      return {
        debug: (t, ...i) => {
          no.debug(e, t, ...i)
        },
        info: (t, ...i) => {
          no.info(e, t, ...i)
        },
        log: (t, ...i) => {
          no.log(e, t, ...i)
        },
        warn: (t, ...i) => {
          no.warn(e, t, ...i)
        },
        error: (t, ...i) => {
          no.error(e, t, ...i)
        },
        fatal: (t, ...i) => {
          no.fatal(e, t, ...i)
        },
      }
    }
    let nl = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, log: 10 },
      nu = class {},
      nc = {
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
    class nd extends nu {
      name = 'ConsoleLogSink'
      verbosity
      constructor(e) {
        ;(super(), (this.verbosity = e ?? 'error'))
      }
      ingest(e) {
        nl[e.level] < nl[this.verbosity] || nc[e.level](...e.messages)
      }
    }
    let nf = na('ApiClient:Retry')
    class nh extends Error {
      status
      constructor(e, t = 500) {
        ;(super(e), Object.setPrototypeOf(this, nh.prototype), (this.status = t))
      }
    }
    async function np(e) {
      if (e <= 0) return
      let { promise: t, resolve: i } = Promise.withResolvers()
      ;(setTimeout(() => {
        i(void 0)
      }, e),
        await t)
    }
    let nv = na('ApiClient:Timeout'),
      ny = na('ApiClient:Fetch'),
      ng = function (e) {
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
                    : nv.error(`Request to "${r.toString()}" timed out`, Error('Request timeout')),
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
                        throw new nh(
                          `${e} API request to "${r.toString()}" failed with status: "[${s.status}] ${s.statusText}".`,
                          503,
                        )
                      if (!s.ok) {
                        let e = Error(
                          `Request to "${r.toString()}" failed with status: [${s.status}] ${s.statusText} - traceparent: ${s.headers.get('traceparent')}`,
                        )
                        ;(nf.error('Request failed with non-OK status:', e), t.abort())
                        return
                      }
                      return (nf.debug(`Response from "${r.toString()}":`, s), s)
                    } catch (e) {
                      if (e instanceof nh && 503 === e.status) throw e
                      ;(nf.error(`Request to "${r.toString()}" failed:`, e), t.abort())
                    }
                  }
                })({ apiName: e, controller: a, fetchMethod: t, init: o, url: s })
              for (let t = 1; t <= l; t++)
                try {
                  let e = await u()
                  if (e) return e
                  break
                } catch (s) {
                  if (!(s instanceof nh) || 503 !== s.status) throw s
                  let r = l - t
                  if ((n?.({ apiName: e, error: s, attemptNumber: t, retriesLeft: r }), 0 === r))
                    throw s
                  await np(i)
                }
              throw Error(`${e} API request to "${s.toString()}" may not be retried.`)
            }
          })({ ...e, fetchMethod: t })
        } catch (e) {
          throw (
            e instanceof Error &&
              ('AbortError' === e.name
                ? ny.warn('Request aborted due to network issues. This request may not be retried.')
                : ny.error('Request failed:', e)),
            e
          )
        }
      },
      nm = na('ApiClient'),
      nb = class {
        name
        clientId
        environment
        fetch
        constructor(e, { fetchOptions: t, clientId: i, environment: n }) {
          ;((this.clientId = i),
            (this.environment = n ?? 'main'),
            (this.name = e),
            (this.fetch = ng({ ...(t ?? {}), apiName: e })))
        }
        logRequestError(e, { requestName: t }) {
          e instanceof Error &&
            ('AbortError' === e.name
              ? nm.warn(
                  `[${this.name}] "${t}" request aborted due to network issues. This request may not be retried.`,
                )
              : nm.error(`[${this.name}] "${t}" request failed:`, e))
        }
      },
      nw = na('ApiClient:Experience')
    class n_ extends nb {
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
        nw.info(`Sending "${i}" request`)
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
            } = ns(nt, await n.json())
          return (
            nw.debug(`"${i}" request successfully completed`),
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
        nw.info(`Sending "${i}" request`)
        let n = this.constructExperienceRequestBody(e, t)
        nw.debug(`"${i}" request body:`, n)
        try {
          let e = await this.makeProfileMutationRequest({
              url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles`,
              body: n,
              options: t,
            }),
            {
              data: { changes: r, experiences: s, profile: o },
            } = ns(nt, await e.json())
          return (
            nw.debug(`"${i}" request successfully completed`),
            { changes: r, selectedOptimizations: s, profile: o }
          )
        } catch (e) {
          throw (this.logRequestError(e, { requestName: i }), e)
        }
      }
      async updateProfile({ profileId: e, events: t }, i = {}) {
        if (!e) throw Error('Valid profile ID required.')
        let n = 'Update Profile'
        nw.info(`Sending "${n}" request`)
        let r = this.constructExperienceRequestBody(t, i)
        nw.debug(`"${n}" request body:`, r)
        try {
          let t = await this.makeProfileMutationRequest({
              url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${e}`,
              body: r,
              options: i,
            }),
            {
              data: { changes: s, experiences: o, profile: a },
            } = ns(nt, await t.json())
          return (
            nw.debug(`"${n}" request successfully completed`),
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
        nw.info(`Sending "${i}" request`)
        let n = ns(i1, { events: e, options: this.constructBodyOptions(t) })
        nw.debug(`"${i}" request body:`, n)
        try {
          let e = await this.makeProfileMutationRequest({
              url: `v2/organizations/${this.clientId}/environments/${this.environment}/events`,
              body: n,
              options: { plainText: !1, ...t },
            }),
            {
              data: { profiles: r },
            } = ns(i8, await e.json())
          return (nw.debug(`"${i}" request successfully completed`), r)
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
        return i0.parse({ events: ns(iX, e), options: this.constructBodyOptions(t) })
      }
    }
    let nz = na('ApiClient:Insights')
    class nO extends nb {
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
          r = ns(nr, e)
        if ('function' == typeof i) {
          if ((nz.debug('Queueing events via beaconHandler'), i(n, r))) return !0
          nz.warn(
            'beaconHandler failed to queue events; events will be emitted immediately via fetch',
          )
        }
        let s = 'Event Batches'
        ;(nz.info(`Sending "${s}" request`), nz.debug(`"${s}" request body:`, r))
        try {
          return (
            await this.fetch(n, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r),
              keepalive: !0,
            }),
            nz.debug(`"${s}" request successfully completed`),
            !0
          )
        } catch (e) {
          return (this.logRequestError(e, { requestName: s }), !1)
        }
      }
    }
    class nE {
      config
      experience
      insights
      constructor(e) {
        const { experience: t, insights: i, clientId: n, environment: r, fetchOptions: s } = e,
          o = { clientId: n, environment: r, fetchOptions: s }
        ;((this.config = o),
          (this.experience = new n_({ ...o, ...t })),
          (this.insights = new nO({ ...o, ...i })))
      }
    }
    function nk(e) {
      if (!e || 'object' != typeof e) return !1
      let t = Object.getPrototypeOf(e)
      return (
        (null === t || t === Object.prototype || null === Object.getPrototypeOf(t)) &&
        '[object Object]' === Object.prototype.toString.call(e)
      )
    }
    function nS(e) {
      return nk(e) || Array.isArray(e)
    }
    let nx = tU({
        campaign: t0(ix),
        locale: t0(tS()),
        location: t0(ij),
        page: t0(iF),
        screen: t0(iR),
        userAgent: t0(tS()),
      }),
      n$ = tN(nx, { componentId: tS(), experienceId: t0(tS()), variantIndex: t0(tI()) }),
      nI = tN(n$, { sticky: t0(tj()), viewId: tS(), viewDurationMs: tI() }),
      nP = tN(n$, { viewId: t0(tS()), viewDurationMs: t0(tI()) }),
      nj = tN(n$, { hoverId: tS(), hoverDurationMs: tI() }),
      nT = tN(nx, { traits: t0(iM), userId: tS() }),
      nF = tN(nx, {
        properties: t0(
          (function (e, t) {
            var i = void 0
            let n = e._zod.def.checks
            if (n && n.length > 0)
              throw Error('.partial() cannot be used on object schemas containing refinements')
            let r = eP(e._zod.def, {
              get shape() {
                let t = e._zod.def.shape,
                  n = { ...t }
                if (i)
                  for (let e in i) {
                    if (!(e in t)) throw Error(`Unrecognized key: "${e}"`)
                    i[e] && (n[e] = tY ? new tY({ type: 'optional', innerType: t[e] }) : t[e])
                  }
                else
                  for (let e in t) n[e] = tY ? new tY({ type: 'optional', innerType: t[e] }) : t[e]
                return (eI(this, 'shape', n), n)
              },
              checks: [],
            })
            return eM(e, r)
          })(iF),
        ),
      }),
      nA = tN(nx, { name: tS(), properties: iA }),
      nR = tN(nx, { event: tS(), properties: t0(t3(iA, {})) }),
      nM = { path: '', query: {}, referrer: '', search: '', title: '', url: '' },
      nC = class {
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
            (this.getPageProperties = s ?? (() => nM)),
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
          } = ns(nI, e)
          return {
            ...this.buildEntryInteractionBase(o, t, n, r),
            type: 'component',
            viewId: i,
            viewDurationMs: s,
          }
        }
        buildClick(e) {
          let { componentId: t, experienceId: i, variantIndex: n, ...r } = ns(n$, e)
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
          } = ns(nj, e)
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
          } = ns(nP, e)
          return {
            ...this.buildEntryInteractionBase(o, t, i, n),
            ...(void 0 === s ? {} : { viewDurationMs: s }),
            ...(void 0 === r ? {} : { viewId: r }),
            type: 'component',
            componentType: 'Variable',
          }
        }
        buildIdentify(e) {
          let { traits: t = {}, userId: i, ...n } = ns(nT, e)
          return {
            ...this.buildUniversalEventProperties(n),
            type: 'identify',
            traits: t,
            userId: i,
          }
        }
        buildPageView(e = {}) {
          let { properties: t = {}, ...i } = ns(nF, e),
            n = this.getPageProperties(),
            r = (function e(t, i) {
              let n = Object.keys(i)
              for (let r = 0; r < n.length; r++) {
                let s = n[r]
                if ('__proto__' === s) continue
                let o = i[s],
                  a = t[s]
                nS(o) && nS(a)
                  ? (t[s] = e(a, o))
                  : Array.isArray(o)
                    ? (t[s] = e([], o))
                    : nk(o)
                      ? (t[s] = e({}, o))
                      : (void 0 === a || void 0 !== o) && (t[s] = o)
              }
              return t
            })({ ...n, title: n.title ?? nM.title }, t),
            {
              context: { screen: s, ...o },
              ...a
            } = this.buildUniversalEventProperties(i),
            l = ns(iV, o)
          return { ...a, context: l, type: 'page', properties: r }
        }
        buildScreenView(e) {
          let { name: t, properties: i, ...n } = ns(nA, e),
            {
              context: { page: r, ...s },
              ...o
            } = this.buildUniversalEventProperties(n),
            a = ns(iZ, { ...s, screen: s.screen ?? { name: t } })
          return { ...o, context: a, type: 'screen', name: t, properties: { name: t, ...i } }
        }
        buildTrack(e) {
          let { event: t, properties: i = {}, ...n } = ns(nR, e)
          return {
            ...this.buildUniversalEventProperties(n),
            type: 'track',
            event: t,
            properties: i,
          }
        }
      }
    class nB {
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
        for (let e of t) i = await e(es(i))
        return i
      }
    }
    let nq = {
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
      nU = na('Optimization'),
      nN = 'Could not resolve Merge Tag value:',
      nV = (e, t) => {
        if (!e || 'object' != typeof e) return
        if (!t) return e
        let i = e
        for (let e of t.split('.').filter(Boolean)) {
          if (!i || ('object' != typeof i && 'function' != typeof i)) return
          i = Reflect.get(i, e)
        }
        return i
      },
      nD = {
        normalizeSelectors: (e) =>
          e
            .split('_')
            .map((e, t, i) =>
              [i.slice(0, t).join('.'), i.slice(t).join('_')].filter((e) => '' !== e).join('.'),
            ),
        getValueFromProfile(e, t) {
          let i = nD.normalizeSelectors(e).find((e) => nV(t, e))
          if (!i) return
          let n = nV(t, i)
          if (n && ('string' == typeof n || 'number' == typeof n || 'boolean' == typeof n))
            return `${n}`
        },
        resolve(e, t) {
          if (!id.safeParse(e).success)
            return void nU.warn(`${nN} supplied entry is not a Merge Tag entry`)
          let {
            fields: { nt_fallback: i },
          } = e
          return i6.safeParse(t).success
            ? (nD.getValueFromProfile(e.fields.nt_mergetag_id, t) ?? i)
            : (nU.warn(`${nN} no valid profile`), i)
        },
      },
      nZ = na('Optimization'),
      nL = 'Could not resolve optimized entry variant:',
      nQ = {
        getOptimizationEntry({ optimizedEntry: e, selectedOptimizations: t }, i = !1) {
          if (i || (t.length && ik(e)))
            return e.fields.nt_experiences
              .filter((e) => iE(e))
              .find((e) => t.some(({ experienceId: t }) => t === e.fields.nt_experience_id))
        },
        getSelectedOptimization({ optimizationEntry: e, selectedOptimizations: t }, i = !1) {
          if (i || (t.length && iE(e)))
            return t.find(({ experienceId: t }) => t === e.fields.nt_experience_id)
        },
        getSelectedVariant(
          { optimizedEntry: e, optimizationEntry: t, selectedVariantIndex: i },
          n = !1,
        ) {
          var r
          if (!n && (!ik(e) || !iE(t))) return
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
          if (!i && (!iE(e) || !ih.safeParse(t).success)) return
          let n = e.fields.nt_variants?.find((e) => e.sys.id === t.id)
          return il.safeParse(n).success ? n : void 0
        },
        resolve: function (e, t) {
          if ((nZ.debug(`Resolving optimized entry for baseline entry ${e.sys.id}`), !t?.length))
            return (
              nZ.warn(`${nL} no selectedOptimizations exist for the current profile`),
              { entry: e }
            )
          if (!ik(e)) return (nZ.warn(`${nL} entry ${e.sys.id} is not optimized`), { entry: e })
          let i = nQ.getOptimizationEntry({ optimizedEntry: e, selectedOptimizations: t }, !0)
          if (!i)
            return (
              nZ.warn(`${nL} could not find an optimization entry for ${e.sys.id}`),
              { entry: e }
            )
          let n = nQ.getSelectedOptimization(
              { optimizationEntry: i, selectedOptimizations: t },
              !0,
            ),
            r = n?.variantIndex ?? 0
          if (0 === r)
            return (
              nZ.debug(`Resolved optimization entry for entry ${e.sys.id} is baseline`),
              { entry: e }
            )
          let s = nQ.getSelectedVariant(
            { optimizedEntry: e, optimizationEntry: i, selectedVariantIndex: r },
            !0,
          )
          if (!s)
            return (
              nZ.warn(`${nL} could not find a valid replacement variant entry for ${e.sys.id}`),
              { entry: e }
            )
          let o = nQ.getSelectedVariantEntry({ optimizationEntry: i, selectedVariant: s }, !0)
          return o
            ? (nZ.debug(`Entry ${e.sys.id} has been resolved to variant entry ${o.sys.id}`),
              { entry: o, selectedOptimization: n })
            : (nZ.warn(`${nL} could not find a valid replacement variant entry for ${e.sys.id}`),
              { entry: e })
        },
      }
    class nJ {
      api
      eventBuilder
      config
      flagsResolver = nq
      mergeTagValueResolver = nD
      optimizedEntryResolver = nQ
      interceptors = { event: new nB(), state: new nB() }
      constructor(e, t = {}) {
        this.config = e
        const { eventBuilder: i, logLevel: n, environment: r, clientId: s, fetchOptions: o } = e
        no.addSink(new nd(n))
        const a = {
          clientId: s,
          environment: r,
          fetchOptions: o,
          experience: t.experience,
          insights: t.insights,
        }
        ;((this.api = new nE(a)),
          (this.eventBuilder = new nC(
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
    let nH = nJ
    function nK() {}
    function nW(e, t) {
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
          let o = A(i),
            a = A(n)
          if ((o === q && (o = Q), a === q && (a = Q), o !== a)) return !1
          switch (o) {
            case M:
              return i.toString() === n.toString()
            case C: {
              let e = i.valueOf(),
                t = n.valueOf()
              return e === t || (Number.isNaN(e) && Number.isNaN(t))
            }
            case B:
            case N:
            case U:
              return Object.is(i.valueOf(), n.valueOf())
            case R:
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
              case V:
                if (i.size !== n.size) return !1
                for (let [t, o] of i.entries())
                  if (!n.has(t) || !e(o, n.get(t), t, i, n, r, s)) return !1
                return !0
              case D: {
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
              case Z:
              case H:
              case K:
              case W:
              case G:
              case '[object BigUint64Array]':
              case X:
              case Y:
              case ee:
              case '[object BigInt64Array]':
              case et:
              case ei:
                if (
                  ('u' > typeof Buffer && Buffer.isBuffer(i) !== Buffer.isBuffer(n)) ||
                  i.length !== n.length
                )
                  return !1
                for (let t = 0; t < i.length; t++) if (!e(i[t], n[t], t, i, n, r, s)) return !1
                return !0
              case L:
                if (i.byteLength !== n.byteLength) return !1
                return t(new Uint8Array(i), new Uint8Array(n), r, s)
              case J:
                if (i.byteLength !== n.byteLength || i.byteOffset !== n.byteOffset) return !1
                return t(new Uint8Array(i), new Uint8Array(n), r, s)
              case '[object Error]':
                return i.name === n.name && i.message === n.message
              case Q: {
                if (!(t(i.constructor, n.constructor, r, s) || (nk(i) && nk(n)))) return !1
                let o = [...Object.keys(i), ...F(i)],
                  a = [...Object.keys(n), ...F(n)]
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
      })(e, t, void 0, void 0, void 0, void 0, nK)
    }
    let nG = na('CoreStateful'),
      nX = {
        trackView: 'component',
        trackFlagView: 'component',
        trackClick: 'component_click',
        trackHover: 'component_hover',
      }
    class nY extends nH {
      flagObservables = new Map()
      getFlag(e, t = ea.value) {
        let i = super.getFlag(e, t),
          n = this.buildFlagViewBuilderArgs(e, t)
        return (
          this.trackFlagView(n).catch((t) => {
            no.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
          }),
          i
        )
      }
      resolveOptimizedEntry(e, t = ep.value) {
        return super.resolveOptimizedEntry(e, t)
      }
      getMergeTagValue(e, t = ey.value) {
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
        let { [e]: t } = nX,
          i =
            void 0 !== t
              ? this.allowedEventTypes.includes(t)
              : this.allowedEventTypes.some((t) => t === e)
        return !!eu.value || i
      }
      onBlockedByConsent(e, t) {
        ;(nG.warn(`Event "${e}" was blocked due to lack of consent; payload: ${JSON.stringify(t)}`),
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
      buildFlagViewBuilderArgs(e, t = ea.value) {
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
            ((t = em.computed(() => super.getFlag(e, ea.value))),
            (i = eo(t)),
            {
              get current() {
                return i.current
              },
              subscribe(e) {
                let t = !1,
                  n = es(i.current)
                return i.subscribe((i) => {
                  ;(t && nW(n, i)) || ((t = !0), (n = es(i)), e(i))
                })
              },
              subscribeOnce: (e) => i.subscribeOnce(e),
            }),
          a = {
            get current() {
              let { current: t } = o
              return (
                r(s(e, ea.value)).catch((t) => {
                  no.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                t
              )
            },
            subscribe: (t) =>
              o.subscribe((i) => {
                ;(r(s(e, ea.value)).catch((t) => {
                  no.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
                }),
                  t(i))
              }),
            subscribeOnce: (t) =>
              o.subscribeOnce((i) => {
                ;(r(s(e, ea.value)).catch((t) => {
                  no.warn(`Failed to emit "flag view" event for "${e}"`, String(t))
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
          nG.warn(`onEventBlocked callback failed for method "${t}"`, e)
        }
        el.value = n
      }
    }
    let n0 = nY,
      n1 = (e, t) => (!Number.isFinite(e) || void 0 === e || e < 1 ? t : Math.floor(e)),
      n2 = {
        flushIntervalMs: 3e4,
        baseBackoffMs: 500,
        maxBackoffMs: 3e4,
        jitterRatio: 0.2,
        maxConsecutiveFailures: 8,
        circuitOpenMs: 12e4,
      },
      n6 = '__ctfl_optimization_stateful_runtime_lock__',
      n3 = () => {
        let e = globalThis
        return ((e[n6] ??= { owner: void 0 }), e[n6])
      },
      n4 = (e) => {
        let t = n3()
        t.owner === e && (t.owner = void 0)
      }
    class n8 {
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
    let n5 = na('CoreStateful')
    class n9 {
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
          (this.flushRuntime = new n8({
            policy: n,
            onRetry: () => {
              this.flush()
            },
            onCallbackError: (e, t) => {
              n5.warn(`Experience flush policy callback "${e}" failed`, t)
            },
          })))
      }
      clearScheduledRetry() {
        this.flushRuntime.clearScheduledRetry()
      }
      async send(e) {
        let t = ns(iG, await this.eventInterceptors.run(e))
        if (((ec.value = t), ed.value)) return await this.upsertProfile([t])
        ;(n5.debug(`Queueing ${t.type} event`, t), this.enqueueEvent(t))
      }
      async flush(e = {}) {
        let { force: t = !1 } = e
        if (this.flushRuntime.shouldSkip({ force: t, isOnline: !!ed.value })) return
        if (0 === this.queuedExperienceEvents.size)
          return void this.flushRuntime.clearScheduledRetry()
        n5.debug('Flushing offline Experience event queue')
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
            n5.warn(
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
          n5.warn('Offline queue drop callback failed', e)
        }
      }
      async tryUpsertQueuedEvents(e) {
        try {
          return (await this.upsertProfile(e), !0)
        } catch (e) {
          return (n5.warn('Experience queue flush request threw an error', e), !1)
        }
      }
      async upsertProfile(e) {
        let t = this.getAnonymousId()
        t && n5.debug(`Anonymous ID found: ${t}`)
        let i = await this.experienceApi.upsertProfile({ profileId: t ?? ey.value?.id, events: e })
        return (await this.updateOutputSignals(i), i)
      }
      async updateOutputSignals(e) {
        let {
          changes: t,
          profile: i,
          selectedOptimizations: n,
        } = await this.stateInterceptors.run(e)
        f(() => {
          ;(nW(ea.value, t) || (ea.value = t),
            nW(ey.value, i) || (ey.value = i),
            nW(ep.value, n) || (ep.value = n))
        })
      }
    }
    let n7 = na('CoreStateful')
    class re {
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
          (this.flushRuntime = new n8({
            policy: i,
            onRetry: () => {
              this.flush()
            },
            onCallbackError: (e, t) => {
              n7.warn(`Insights flush policy callback "${e}" failed`, t)
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
        let { value: t } = ey
        if (!t) return void n7.warn('Attempting to emit an event without an Optimization profile')
        let i = ns(ni, await this.eventInterceptors.run(e))
        n7.debug(`Queueing ${i.type} event for profile ${t.id}`, i)
        let n = this.queuedInsightsByProfile.get(t.id)
        ;((ec.value = i),
          n
            ? ((n.profile = t), n.events.push(i))
            : this.queuedInsightsByProfile.set(t.id, { profile: t, events: [i] }),
          this.ensurePeriodicFlushTimer(),
          this.getQueuedEventCount() >= 25 && (await this.flush()),
          this.reconcilePeriodicFlushTimer())
      }
      async flush(e = {}) {
        let { force: t = !1 } = e
        if (this.flushRuntime.shouldSkip({ force: t, isOnline: !!ed.value })) return
        n7.debug('Flushing insights event queue')
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
          return (n7.warn('Insights queue flush request threw an error', e), !1)
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
    let rt = Symbol.for('ctfl.optimization.preview.signals'),
      ri = Symbol.for('ctfl.optimization.preview.signalFns'),
      rn = na('CoreStateful'),
      rr = ['identify', 'page', 'screen'],
      rs = (e) => Object.values(e).some((e) => void 0 !== e),
      ro = 0
    class ra extends n0 {
      singletonOwner
      destroyed = !1
      allowedEventTypes
      experienceQueue
      insightsQueue
      onEventBlocked
      states = {
        blockedEventStream: eo(el),
        flag: (e) => this.getFlagObservable(e),
        consent: eo(eu),
        eventStream: eo(ec),
        canOptimize: eo(ev),
        selectedOptimizations: eo(ep),
        previewPanelAttached: eo(ef),
        previewPanelOpen: eo(eh),
        profile: eo(ey),
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
            return rs(t) ? t : void 0
          })(e.api),
          insights: ((e) => {
            if (void 0 === e) return
            let t = { baseUrl: e.insightsBaseUrl, beaconHandler: e.beaconHandler }
            return rs(t) ? t : void 0
          })(e.api),
        }),
          (this.singletonOwner = `CoreStateful#${++ro}`),
          ((e) => {
            let t = n3()
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
              flush: ((e, t = n2) => {
                var i, n
                let r = e ?? {},
                  s = n1(r.baseBackoffMs, t.baseBackoffMs),
                  o = Math.max(s, n1(r.maxBackoffMs, t.maxBackoffMs))
                return {
                  flushIntervalMs: n1(r.flushIntervalMs, t.flushIntervalMs),
                  baseBackoffMs: s,
                  maxBackoffMs: o,
                  jitterRatio:
                    ((i = r.jitterRatio),
                    (n = t.jitterRatio),
                    Number.isFinite(i) && void 0 !== i ? Math.min(1, Math.max(0, i)) : n),
                  maxConsecutiveFailures: n1(r.maxConsecutiveFailures, t.maxConsecutiveFailures),
                  circuitOpenMs: n1(r.circuitOpenMs, t.circuitOpenMs),
                  onCircuitOpen: r.onCircuitOpen,
                  onFlushFailure: r.onFlushFailure,
                  onFlushRecovered: r.onFlushRecovered,
                }
              })(e?.flush),
              offlineMaxEvents: n1(e?.offlineMaxEvents, 100),
              onOfflineDrop: e?.onOfflineDrop,
            }))(s)
          ;((this.allowedEventTypes = t ?? rr),
            (this.onEventBlocked = r),
            (this.insightsQueue = new re({
              eventInterceptors: this.interceptors.event,
              flushPolicy: c.flush,
              insightsApi: this.api.insights,
            })),
            (this.experienceQueue = new n9({
              experienceApi: this.api.experience,
              eventInterceptors: this.interceptors.event,
              flushPolicy: c.flush,
              getAnonymousId: n ?? (() => void 0),
              offlineMaxEvents: c.offlineMaxEvents,
              onOfflineDrop: c.onOfflineDrop,
              stateInterceptors: this.interceptors.state,
            })),
            void 0 !== a && (eu.value = a),
            f(() => {
              ;(void 0 !== o && (ea.value = o),
                void 0 !== l && (ep.value = l),
                void 0 !== u && (ey.value = u))
            }),
            this.initializeEffects())
        } catch (e) {
          throw (n4(this.singletonOwner), e)
        }
      }
      initializeEffects() {
        ;(T(() => {
          rn.debug(
            `Profile ${ey.value && `with ID ${ey.value.id}`} has been ${ey.value ? 'set' : 'cleared'}`,
          )
        }),
          T(() => {
            rn.debug(`Variants have been ${ep.value?.length ? 'populated' : 'cleared'}`)
          }),
          T(() => {
            rn.info(
              `Core ${eu.value ? 'will' : 'will not'} emit gated events due to consent (${eu.value})`,
            )
          }),
          T(() => {
            ed.value &&
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
            no.warn('Failed to flush insights queue during destroy()', String(e))
          }),
          this.experienceQueue.flush({ force: !0 }).catch((e) => {
            no.warn('Failed to flush Experience queue during destroy()', String(e))
          }),
          this.insightsQueue.clearPeriodicFlushTimer(),
          n4(this.singletonOwner))
      }
      reset() {
        f(() => {
          ;((el.value = void 0),
            (ec.value = void 0),
            (ea.value = void 0),
            (ey.value = void 0),
            (ep.value = void 0))
        })
      }
      async flush() {
        await this.flushQueues()
      }
      consent(e) {
        eu.value = e
      }
      get online() {
        return ed.value ?? !1
      }
      set online(e) {
        ed.value = e
      }
      registerPreviewPanel(e) {
        ;(Reflect.set(e, rt, eg), Reflect.set(e, ri, em))
      }
    }
    let rl = null,
      ru = null,
      rc = null,
      rd = new Map(),
      rf = new Map(),
      rh = new Map(),
      rp = new Map()
    function rv() {
      ;(rd.clear(), rf.clear(), rh.clear(), rp.clear())
    }
    let ry = {
      initialize(e) {
        ;(rl && ry.destroy(),
          (rl = new ra({
            clientId: e.clientId,
            environment: e.environment,
            api: { experienceBaseUrl: e.experienceBaseUrl, insightsBaseUrl: e.insightsBaseUrl },
          })),
          e.defaults &&
            (void 0 !== e.defaults.consent && rl.consent(e.defaults.consent),
            void 0 !== e.defaults.profile && (eg.profile.value = e.defaults.profile),
            void 0 !== e.defaults.changes && (eg.changes.value = e.defaults.changes),
            void 0 !== e.defaults.optimizations &&
              (eg.selectedOptimizations.value = e.defaults.optimizations)),
          rl.consent(!0))
        let t = globalThis
        ;((ru = T(() => {
          let e = {
            profile: eg.profile.value ?? null,
            consent: eg.consent.value,
            canPersonalize: eg.canOptimize.value,
            changes: eg.changes.value ?? null,
            selectedPersonalizations: eg.selectedOptimizations.value ?? null,
          }
          'function' == typeof t.__nativeOnStateChange && t.__nativeOnStateChange(JSON.stringify(e))
        })),
          (rc = T(() => {
            let e = eg.event.value
            e &&
              'function' == typeof t.__nativeOnEventEmitted &&
              t.__nativeOnEventEmitted(JSON.stringify(e))
          })))
      },
      identify(e, t, i) {
        rl
          ? rl
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
        rl
          ? rl
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
        rl
          ? rl
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
        rl
          ? rl
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
        rl
          ? rl
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
        rl
          ? rl
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
        rl && rl.consent(e)
      },
      reset() {
        rl && (rv(), rl.reset())
      },
      setOnline(e) {
        eg.online.value = e
      },
      personalizeEntry: (e, t) =>
        rl ? JSON.stringify(rl.resolveOptimizedEntry(e, t)) : JSON.stringify({ entry: e }),
      setPreviewPanelOpen(e) {
        rl && (eg.previewPanelOpen.value = e)
      },
      overrideAudience(e, t) {
        if (!rl) return
        ;(!(function (e) {
          if (rd.has(e)) return
          let t = (eg.changes.value ?? []).find((t) => t.audienceId === e)
          rd.set(e, t?.qualified ?? !1)
        })(e),
          rh.set(e, t))
        let i = (eg.changes.value ?? []).map((i) =>
          i.audienceId === e ? { ...i, qualified: t } : i,
        )
        eg.changes.value = i
      },
      overrideVariant(e, t) {
        if (!rl) return
        ;(!(function (e) {
          if (rf.has(e)) return
          let t = (eg.selectedOptimizations.value ?? []).find((t) => t.experienceId === e)
          rf.set(e, t?.variantIndex ?? 0)
        })(e),
          rp.set(e, t))
        let i = (eg.selectedOptimizations.value ?? []).map((i) =>
          i.experienceId === e ? { ...i, variantIndex: t } : i,
        )
        eg.selectedOptimizations.value = i
      },
      resetAudienceOverride(e) {
        if (!rl) return
        let t = rd.get(e)
        if (void 0 === t) return
        rh.delete(e)
        let i = (eg.changes.value ?? []).map((i) =>
          i.audienceId === e ? { ...i, qualified: t } : i,
        )
        eg.changes.value = i
      },
      resetVariantOverride(e) {
        if (!rl) return
        let t = rf.get(e)
        if (void 0 === t) return
        rp.delete(e)
        let i = (eg.selectedOptimizations.value ?? []).map((i) =>
          i.experienceId === e ? { ...i, variantIndex: t } : i,
        )
        eg.selectedOptimizations.value = i
      },
      resetAllOverrides() {
        if (!rl) return
        let e = (eg.changes.value ?? []).map((e) => {
          let t = e.audienceId
          return t && rd.has(t) ? { ...e, qualified: rd.get(t) } : e
        })
        eg.changes.value = e
        let t = (eg.selectedOptimizations.value ?? []).map((e) => {
          let t = e.experienceId
          return t && rf.has(t) ? { ...e, variantIndex: rf.get(t) } : e
        })
        ;((eg.selectedOptimizations.value = t), rv())
      },
      getPreviewState() {
        let e = {}
        rh.forEach((t, i) => {
          e[i] = t
        })
        let t = {}
        rp.forEach((e, i) => {
          t[i] = e
        })
        let i = {}
        rd.forEach((e, t) => {
          i[t] = e
        })
        let n = {}
        return (
          rf.forEach((e, t) => {
            n[t] = e
          }),
          JSON.stringify({
            profile: eg.profile.value ?? null,
            consent: eg.consent.value,
            canPersonalize: eg.canOptimize.value,
            changes: eg.changes.value ?? null,
            selectedPersonalizations: eg.selectedOptimizations.value ?? null,
            previewPanelOpen: eg.previewPanelOpen.value,
            audienceOverrides: e,
            variantOverrides: t,
            defaultAudienceQualifications: i,
            defaultVariantIndices: n,
          })
        )
      },
      getProfile() {
        let e = eg.profile.value
        return e ? JSON.stringify(e) : null
      },
      getState: () =>
        JSON.stringify({
          profile: eg.profile.value ?? null,
          consent: eg.consent.value,
          canPersonalize: eg.canOptimize.value,
          changes: eg.changes.value ?? null,
          selectedPersonalizations: eg.selectedOptimizations.value ?? null,
        }),
      destroy() {
        ;(rv(),
          rc && (rc(), (rc = null)),
          ru && (ru(), (ru = null)),
          rl && (rl.destroy(), (rl = null)))
      },
    }
    globalThis.__bridge = ry
    let rg = ry
    return u.default
  })(),
)
//# sourceMappingURL=optimization-ios-bridge.umd.js.map

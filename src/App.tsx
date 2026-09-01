// import { useState } from 'react'
import './App.css'

export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">Engine Power Checks</a>
        </div>

        <div className="flex-none gap-2">
          <button className="btn btn-ghost">Aircraft</button>
          <button className="btn btn-ghost">Settings</button>
          <button className="btn btn-primary">New Check</button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card bg-base-100 shadow lg:col-span-2">
            <div className="card-body">
              <h2 className="card-title">New Power Check</h2>
              <p className="text-base-content/70">
                Enter conditions and readings, then compute expected vs actual.
              </p>

              <div className="divider" />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Aircraft / Engine</span>
                  </div>
                  <select className="select select-bordered">
                    <option>Pick one…</option>
                  </select>
                </label>

                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Check Type</span>
                  </div>
                  <select className="select select-bordered">
                    <option>Static RPM</option>
                    <option>MAP / RPM (Cruise)</option>
                    <option>Takeoff Power</option>
                    <option>Climb Power</option>
                  </select>
                </label>

                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Pressure Altitude (ft)</span>
                  </div>
                  <input className="input input-bordered" inputMode="numeric" placeholder="e.g. 2500" />
                </label>

                <label className="form-control">
                  <div className="label">
                    <span className="label-text">OAT (°C)</span>
                  </div>
                  <input className="input input-bordered" inputMode="numeric" placeholder="e.g. 18" />
                </label>

                <label className="form-control">
                  <div className="label">
                    <span className="label-text">RPM</span>
                  </div>
                  <input className="input input-bordered" inputMode="numeric" placeholder="e.g. 2350" />
                </label>

                <label className="form-control">
                  <div className="label">
                    <span className="label-text">MAP (inHg) (if applicable)</span>
                  </div>
                  <input className="input input-bordered" inputMode="numeric" placeholder="e.g. 24.5" />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-outline">Load Profile</button>
                <button className="btn btn-outline">Save Draft</button>
                <button className="btn btn-primary">Compute</button>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Result</h2>

              <div className="stats stats-vertical bg-base-100">
                <div className="stat">
                  <div className="stat-title">Expected</div>
                  <div className="stat-value text-2xl">—</div>
                  <div className="stat-desc">From performance model</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Actual</div>
                  <div className="stat-value text-2xl">—</div>
                  <div className="stat-desc">From entered readings</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Delta</div>
                  <div className="stat-value text-2xl">—</div>
                  <div className="stat-desc">Pass/Fail threshold</div>
                </div>
              </div>

              <div className="mt-4 alert">
                <span>Run “Compute” to see pass/fail and details.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
